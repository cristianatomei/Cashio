import { Platform } from 'react-native';
import type { AppDb } from '@/core/db';
import { eventMarker, exportRange } from '../domain/events';
import { newCalendarState } from '../domain/state';
import { readCalendarState, saveCalendarState, syncCalendar, writableCalendars } from './sync';

jest.mock('@/core/db', () => ({
  schema: { appSettings: { key: 'key' }, recurringRules: 'rules', loanSchedules: 'loans' },
}));
jest.mock('expo-calendar', () => ({
  requestCalendarPermissions: jest.fn(),
  getCalendars: jest.fn(),
  EntityTypes: { EVENT: 'event' },
  ExpoCalendarEvent: { get: jest.fn() },
}));

const api = jest.requireMock('expo-calendar');
const now = new Date(2026, 9, 28, 12).getTime();
const dueAt = new Date(2026, 10, 10).getTime();
type MockEvent = {
  id: string;
  calendarId: string;
  notes: string;
  startDate: Date;
  update: jest.Mock;
  delete: jest.Mock;
};
let stored: string | null;
let rules: object[];
let loans: object[];
let events: Map<string, MockEvent>;
let failAfterCreate: boolean;
let failSave: boolean;
let nextId: number;
const db = {
  select: () => ({
    from: (table: string) => ({
      where: () => ({ get: () => (stored ? { value: stored } : undefined) }),
      all: () => (table === 'rules' ? rules : loans),
    }),
  }),
  insert: () => ({
    values: ({ value }: { value: string }) => ({
      onConflictDoUpdate: () => ({
        run: () => {
          if (failSave) throw new Error('disk full');
          stored = value;
        },
      }),
    }),
  }),
  delete: () => ({
    where: () => ({
      run: () => {
        stored = null;
      },
    }),
  }),
} as unknown as AppDb;

function nativeEvent(id: string, notes: string, startDate = new Date(dueAt)): MockEvent {
  const event: MockEvent = {
    id,
    calendarId: 'chosen',
    notes,
    startDate,
    update: jest.fn(async (details) => {
      Object.assign(event, details);
    }),
    delete: jest.fn(async () => {
      events.delete(id);
    }),
  };
  events.set(id, event);
  return event;
}

const calendar = {
  id: 'chosen',
  title: 'Test calendar',
  allowsModifications: true,
  listEvents: jest.fn(async (from: Date, to: Date) =>
    [...events.values()].filter((event) => event.startDate >= from && event.startDate < to),
  ),
  createEvent: jest.fn(async (details) => {
    const event = nativeEvent(`event-${++nextId}`, details.notes, details.startDate);
    if (failAfterCreate) {
      failAfterCreate = false;
      throw new Error('native save succeeded but response failed');
    }
    return event;
  }),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  stored = null;
  events = new Map();
  rules = [
    {
      id: 1,
      type: 'expense',
      amountMinor: 12345,
      amountVariable: false,
      currency: 'RON',
      frequency: 'monthly',
      interval: 1,
      nextDue: dueAt,
      endAt: dueAt,
      active: true,
      note: 'Private note',
      accountId: 99,
    },
  ];
  loans = [];
  failAfterCreate = false;
  failSave = false;
  nextId = 0;
  api.requestCalendarPermissions.mockResolvedValue({ granted: true });
  api.getCalendars.mockResolvedValue([calendar]);
  api.ExpoCalendarEvent.get.mockImplementation(async (id: string) => {
    const event = events.get(id);
    if (!event) throw Object.assign(new Error('missing'), { code: 'ERR_EVENT_NOT_FOUND' });
    return event;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function enable() {
  const state = newCalendarState(calendar);
  saveCalendarState(db, state);
  return state;
}

it('does not request permissions or access calendar data before opt-in', async () => {
  expect(await syncCalendar(db, () => 'Payment')).toBe(0);
  expect(api.requestCalendarPermissions).not.toHaveBeenCalled();
});

it('requests full event-only access and rejects denied permission and missing calendars', async () => {
  api.requestCalendarPermissions.mockResolvedValueOnce({ granted: false });
  await expect(writableCalendars()).rejects.toMatchObject({ reason: 'permission' });
  expect(api.getCalendars).not.toHaveBeenCalled();
  api.getCalendars.mockResolvedValueOnce([{ ...calendar, allowsModifications: false }]);
  await expect(writableCalendars()).rejects.toMatchObject({ reason: 'noCalendar' });
  expect(api.requestCalendarPermissions).toHaveBeenCalledWith(false);
  expect(api.getCalendars).toHaveBeenCalledWith('event');
});

it('rejects web without calling native APIs', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  await expect(writableCalendars()).rejects.toMatchObject({ reason: 'native' });
  expect(api.requestCalendarPermissions).not.toHaveBeenCalled();
});

it('creates then updates idempotently, exporting no private source metadata or alarms', async () => {
  enable();
  const title = jest.fn(() => 'Cashio · Payment · RON 123.45');
  expect(await syncCalendar(db, title)).toBe(1);
  expect(await syncCalendar(db, title)).toBe(1);
  expect(calendar.createEvent).toHaveBeenCalledTimes(1);
  expect([...events.values()][0].update).toHaveBeenCalledTimes(1);
  expect(calendar.createEvent.mock.calls[0][0]).toMatchObject({
    title: 'Cashio · Payment · RON 123.45',
    allDay: true,
    alarms: [],
    recurrenceRule: null,
  });
  expect(JSON.stringify(calendar.createEvent.mock.calls)).not.toContain('Private note');
  expect(JSON.stringify(calendar.createEvent.mock.calls)).not.toContain('accountId');
  expect(readCalendarState(db)?.eventIds).toHaveLength(1);
});

it('removes deleted payments while leaving personal and other-owner events unchanged', async () => {
  enable();
  await syncCalendar(db, () => 'Payment');
  const personal = nativeEvent('personal', 'A personal event');
  const foreign = nativeEvent('foreign', eventMarker('other-owner', `recurring-1-${dueAt}`));
  rules = [];
  expect(await syncCalendar(db, () => 'Payment')).toBe(0);
  expect([...events.keys()].sort()).toEqual(['foreign', 'personal']);
  expect(personal.delete).not.toHaveBeenCalled();
  expect(foreign.delete).not.toHaveBeenCalled();
});

it('recovers tagged events after an interrupted create instead of duplicating them', async () => {
  enable();
  failAfterCreate = true;
  await expect(syncCalendar(db, () => 'Payment')).rejects.toThrow('native save succeeded');
  expect(events.size).toBe(1);
  expect(readCalendarState(db)?.eventIds).toEqual([]);
  await syncCalendar(db, () => 'Payment');
  expect(events.size).toBe(1);
  expect(calendar.createEvent).toHaveBeenCalledTimes(1);
  expect([...events.values()][0].update).toHaveBeenCalledTimes(1);
});

it('does not write native events if the recovery journal cannot be persisted', async () => {
  enable();
  failSave = true;
  await expect(syncCalendar(db, () => 'Payment')).rejects.toThrow('disk full');
  expect(calendar.createEvent).not.toHaveBeenCalled();
});

it('finds moved managed events by ID and removes events outside the new window', async () => {
  const state = enable();
  await syncCalendar(db, () => 'Payment');
  const moved = [...events.values()][0];
  moved.startDate = new Date(2030, 0, 1);
  rules = [];
  await syncCalendar(db, () => 'Payment');
  expect(moved.delete).toHaveBeenCalledTimes(1);
  expect(api.ExpoCalendarEvent.get).toHaveBeenCalledWith(moved.id);
  expect(readCalendarState(db)?.owner).toBe(state.owner);
});

it('recreates manually deleted events, but never treats transient lookup errors as deletion', async () => {
  enable();
  await syncCalendar(db, () => 'Payment');
  events.clear();
  api.ExpoCalendarEvent.get.mockRejectedValueOnce(new Error('provider offline'));
  await expect(syncCalendar(db, () => 'Payment')).rejects.toThrow('provider offline');
  expect(calendar.createEvent).toHaveBeenCalledTimes(1);
  await syncCalendar(db, () => 'Payment');
  expect(calendar.createEvent).toHaveBeenCalledTimes(2);
  expect(events.size).toBe(1);
});

it('handles SDK57 Android missing-ID wrapper error without hiding other TypeErrors', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  enable();
  await syncCalendar(db, () => 'Payment');
  expect(calendar.createEvent.mock.calls[0][0].timeZone).toBe('UTC');
  events.clear();
  api.ExpoCalendarEvent.get.mockRejectedValueOnce(new TypeError('unexpected failure'));
  await expect(syncCalendar(db, () => 'Payment')).rejects.toThrow('unexpected failure');
  api.ExpoCalendarEvent.get.mockRejectedValueOnce(
    new TypeError('Object.setPrototypeOf called on null or undefined'),
  );
  await syncCalendar(db, () => 'Payment');
  expect(events.size).toBe(1);
});

it('disables before cleanup, retains failed cleanup records, and allows a safe retry', async () => {
  enable();
  await syncCalendar(db, () => 'Payment');
  const personal = nativeEvent('personal', 'Personal');
  api.requestCalendarPermissions.mockResolvedValueOnce({ granted: false });
  await expect(syncCalendar(db, () => '', true)).rejects.toMatchObject({ reason: 'permission' });
  expect(readCalendarState(db)?.enabled).toBe(false);
  expect(readCalendarState(db)?.eventIds).toHaveLength(1);
  expect(await syncCalendar(db, () => '')).toBe(0);
  await syncCalendar(db, () => '', true);
  expect(stored).toBeNull();
  expect([...events.keys()]).toEqual(['personal']);
  expect(personal.delete).not.toHaveBeenCalled();
});

it('retains the selected calendar and journal if it becomes unavailable', async () => {
  const state = enable();
  api.getCalendars.mockResolvedValueOnce([{ ...calendar, id: 'another' }]);
  await expect(syncCalendar(db, () => '')).rejects.toMatchObject({ reason: 'noCalendar' });
  expect(readCalendarState(db)).toEqual(state);
  expect(calendar.createEvent).not.toHaveBeenCalled();
});

it('exports real varying loan installments, not a fixed recurrence or private names', async () => {
  enable();
  rules = [];
  loans = [
    {
      id: 2,
      name: 'Private bank name',
      currency: 'EUR',
      recurringId: null,
      installmentsJson: JSON.stringify({
        includeInsurance: true,
        remindersEnabled: false,
        installments: [dueAt, dueAt + 5 * 86400000].map((due, index) => ({
          dueAt: due,
          paymentMinor: 20000 - index * 1000,
          principalMinor: 18000,
          interestMinor: 2000 - index * 1000,
          balanceMinor: null,
          insuranceMinor: 300 - index * 20,
        })),
      }),
    },
  ];
  const title = jest.fn((payment) => `Installment ${payment.amountMinor} ${payment.currency}`);
  expect(await syncCalendar(db, title)).toBe(2);
  expect(calendar.createEvent.mock.calls.map(([details]) => details.title)).toEqual([
    'Installment 20300 EUR',
    'Installment 19280 EUR',
  ]);
  expect(
    calendar.createEvent.mock.calls.every(([details]) => details.recurrenceRule === null),
  ).toBe(true);
  expect(JSON.stringify(calendar.createEvent.mock.calls)).not.toContain('Private bank name');
});

it('rejects overlapping sync requests and releases the lock after completion', async () => {
  enable();
  let release!: (value: { granted: boolean }) => void;
  api.requestCalendarPermissions.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const first = syncCalendar(db, () => 'Payment');
  // Yield to the module loader without starving its event-loop work.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await expect(syncCalendar(db, () => 'Payment')).rejects.toMatchObject({ reason: 'busy' });
  release({ granted: true });
  await first;
  expect(await syncCalendar(db, () => 'Payment')).toBe(1);
});

it('retains previous recovery windows until successful reconciliation', async () => {
  const state = enable();
  state.windows = [exportRange(new Date(2025, 0, 1).getTime())];
  saveCalendarState(db, state);
  failAfterCreate = true;
  await expect(syncCalendar(db, () => 'Payment')).rejects.toThrow();
  expect(readCalendarState(db)?.windows).toHaveLength(2);
  await syncCalendar(db, () => 'Payment');
  expect(readCalendarState(db)?.windows).toEqual([exportRange(now)]);
});
