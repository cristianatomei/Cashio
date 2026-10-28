import type { ExportRange } from './events';

export const CALENDAR_STATE_KEY = 'calendar_export_v1';
export type CalendarState = {
  owner: string;
  enabled: boolean;
  calendarId: string;
  calendarTitle: string;
  windows: ExportRange[];
  eventIds: string[];
};

export function newCalendarState(calendar: { id: string; title: string }): CalendarState {
  return {
    owner: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    enabled: true,
    calendarId: calendar.id,
    calendarTitle: calendar.title,
    windows: [],
    eventIds: [],
  };
}
