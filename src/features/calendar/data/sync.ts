import { eq } from 'drizzle-orm';
import { Platform } from 'react-native';
import type * as CalendarModule from 'expo-calendar';

import { type AppDb, schema } from '@/core/db';
import { parseStoredLoanSchedule } from '@/features/loans/domain/storedSchedule';
import {
  eventDates,
  eventMarker,
  exportRange,
  managedKey,
  projectPayments,
  selectSync,
  type CalendarPayment,
} from '../domain/events';
import { CALENDAR_STATE_KEY, type CalendarState } from '../domain/state';

export { CALENDAR_STATE_KEY, type CalendarState } from '../domain/state';
export class CalendarExportError extends Error {
  constructor(public readonly reason: 'permission' | 'noCalendar' | 'native' | 'busy') {
    super(reason);
  }
}

export function readCalendarState(db: AppDb): CalendarState | null {
  const row = db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, CALENDAR_STATE_KEY))
    .get();
  return row ? (JSON.parse(row.value) as CalendarState) : null;
}

export function saveCalendarState(db: AppDb, state: CalendarState): void {
  const value = JSON.stringify(state);
  db.insert(schema.appSettings)
    .values({ key: CALENDAR_STATE_KEY, value })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value } })
    .run();
}

async function calendarApi(): Promise<typeof CalendarModule> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new CalendarExportError('native');
  }
  try {
    // Lazy loading keeps settings usable in Expo Go and builds without the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('expo-calendar') as typeof CalendarModule;
    if (
      typeof api.requestCalendarPermissions !== 'function' ||
      typeof api.ExpoCalendarEvent?.get !== 'function'
    ) {
      throw new CalendarExportError('native');
    }
    return api;
  } catch {
    throw new CalendarExportError('native');
  }
}

export async function writableCalendars() {
  const api = await calendarApi();
  const permission = await api.requestCalendarPermissions(false);
  if (!permission.granted) throw new CalendarExportError('permission');
  const calendars = (await api.getCalendars(api.EntityTypes.EVENT)).filter(
    (calendar) => calendar.allowsModifications,
  );
  if (calendars.length === 0) throw new CalendarExportError('noCalendar');
  return calendars;
}

let syncing = false;

/** Manual, serialized reconciliation. Journal writes precede native writes for crash recovery. */
export async function syncCalendar(
  db: AppDb,
  title: (payment: CalendarPayment) => string,
  cleanup = false,
): Promise<number> {
  if (syncing) throw new CalendarExportError('busy');
  syncing = true;
  try {
    const state = readCalendarState(db);
    if (!state || (!state.enabled && !cleanup)) return 0;
    if (cleanup) {
      state.enabled = false;
      saveCalendarState(db, state);
    }
    const calendars = await writableCalendars();
    const calendar = calendars.find((item) => item.id === state.calendarId);
    if (!calendar) throw new CalendarExportError('noCalendar');
    const api = await calendarApi();
    const range = exportRange(Date.now());
    const desired = cleanup
      ? []
      : projectPayments(
          db
            .select()
            .from(schema.recurringRules)
            .all()
            .map((row) => ({
              ...row,
              name: '',
            })),
          db
            .select()
            .from(schema.loanSchedules)
            .all()
            .map((row) => ({
              ...row,
              ...parseStoredLoanSchedule(row.installmentsJson),
            })),
          range,
        );
    if (
      !cleanup &&
      !state.windows.some((item) => item.from === range.from && item.to === range.to)
    ) {
      state.windows.push(range);
    }
    saveCalendarState(db, state);
    const existing = new Map<string, CalendarModule.ExpoCalendarEvent>();
    // Query in yearly chunks: EventKit limits the length of a search predicate.
    for (const window of state.windows) {
      for (let from = window.from; from < window.to;) {
        const to = Math.min(window.to, from + 366 * 86400000);
        for (const event of await calendar.listEvents(
          new Date(from - 86400000),
          new Date(to + 86400000),
        )) {
          if (managedKey(event, state.calendarId, state.owner)) existing.set(event.id, event);
        }
        from = to;
      }
    }
    // IDs also find managed events moved outside the exported dates by a calendar editor.
    for (const id of state.eventIds) {
      if (existing.has(id)) continue;
      try {
        const event = await api.ExpoCalendarEvent.get(id);
        if (managedKey(event, state.calendarId, state.owner)) existing.set(id, event);
      } catch (error) {
        // Only a confirmed native "not found" means deletion. Other failures must be retried.
        // SDK57 Android returns null for a missing ID, but the JS wrapper calls setPrototypeOf
        // on it. Do not treat other TypeErrors or transient native failures as a missing event.
        const androidMissing =
          Platform.OS === 'android' &&
          error instanceof TypeError &&
          /(?:setPrototypeOf.*(?:null|undefined)|(?:null|undefined).*setPrototypeOf)/i.test(
            error.message,
          );
        if ((error as { code?: string }).code !== 'ERR_EVENT_NOT_FOUND' && !androidMissing)
          throw error;
      }
    }
    state.eventIds = [...existing.keys()];
    saveCalendarState(db, state);
    const plan = selectSync(desired, [...existing.values()], state.calendarId, state.owner);
    const details = (payment: CalendarPayment) => ({
      title: title(payment),
      notes: eventMarker(state.owner, payment.key),
      ...eventDates(payment.dueAt, Platform.OS === 'android'),
      timeZone:
        Platform.OS === 'android' ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone,
      allDay: true,
      recurrenceRule: null,
      alarms: [],
    });
    for (const id of plan.remove) {
      await existing.get(id)!.delete();
      state.eventIds = state.eventIds.filter((value) => value !== id);
      saveCalendarState(db, state);
    }
    for (const item of plan.update) {
      await existing.get(item.id)!.update(details(item.payment));
    }
    for (const payment of plan.create) {
      const event = await calendar.createEvent(details(payment));
      state.eventIds.push(event.id);
      saveCalendarState(db, state);
    }
    state.windows = cleanup ? [] : [range];
    if (cleanup) {
      db.delete(schema.appSettings).where(eq(schema.appSettings.key, CALENDAR_STATE_KEY)).run();
    } else {
      saveCalendarState(db, state);
    }
    return desired.length;
  } finally {
    syncing = false;
  }
}
