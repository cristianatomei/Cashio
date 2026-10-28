import { startOfDay } from '@/core/utils/dates';
import { installmentTotal, type LoanInstallment } from '@/features/loans/domain/ingSchedule';
import {
  recurringPaymentsInRange,
  type ScheduledRecurringRule,
} from '@/features/recurring/domain/schedule';

export type ExportRange = { from: number; to: number };
export type CalendarPayment = {
  key: string;
  kind: 'recurring' | 'loan';
  dueAt: number;
  amountMinor: number;
  currency: string;
  estimated: boolean;
};
export type ExportRule = ScheduledRecurringRule & {
  type: 'expense' | 'income';
  amountVariable: boolean;
};
export type ExportLoan = {
  id: number;
  recurringId: number | null;
  currency: string;
  includeInsurance: boolean;
  installments: readonly LoanInstallment[];
};

/** Today (inclusive) to the same calendar day next year (exclusive), clamped for leap day. */
export function exportRange(now: number): ExportRange {
  const from = startOfDay(now);
  const day = new Date(from);
  const lastDay = new Date(day.getFullYear() + 1, day.getMonth() + 1, 0).getDate();
  return {
    from,
    to: new Date(day.getFullYear() + 1, day.getMonth(), Math.min(day.getDate(), lastDay)).getTime(),
  };
}

export function projectPayments(
  rules: readonly ExportRule[],
  loans: readonly ExportLoan[],
  range: ExportRange,
): CalendarPayment[] {
  const linkedRules = new Set(loans.map((loan) => loan.recurringId));
  const selectedRules = rules.filter(
    (rule) => rule.type === 'expense' && !linkedRules.has(rule.id),
  );
  const recurring: CalendarPayment[] = recurringPaymentsInRange(
    selectedRules,
    range.from,
    range.to,
  ).map((payment) => ({
    key: payment.key,
    dueAt: payment.dueAt,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    kind: 'recurring',
    estimated:
      selectedRules.find((rule) => payment.key.startsWith(`recurring-${rule.id}-`))
        ?.amountVariable ?? false,
  }));
  const installments: CalendarPayment[] = loans.flatMap((loan) =>
    loan.installments
      .filter((row) => row.dueAt >= range.from && row.dueAt < range.to)
      .map((row) => ({
        key: `loan-${loan.id}-${row.dueAt}`,
        kind: 'loan' as const,
        dueAt: row.dueAt,
        amountMinor: installmentTotal(row, loan.includeInsurance),
        currency: loan.currency,
        estimated: false,
      })),
  );
  return [...recurring, ...installments].sort(
    (a, b) => a.dueAt - b.dueAt || a.key.localeCompare(b.key),
  );
}

export function eventDates(dueAt: number, utc = true): { startDate: Date; endDate: Date } {
  const day = new Date(dueAt);
  // Android CalendarContract requires UTC all-day dates; EventKit uses local calendar days.
  const date = (offset: number) =>
    utc
      ? new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate() + offset))
      : new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset);
  const startDate = date(0);
  const endDate = date(1);
  return { startDate, endDate };
}

export function eventMarker(owner: string, key: string): string {
  return `Cashio calendar v1:${owner}:${key}`;
}

export type ExistingEvent = { id: string; calendarId: string; notes: string | null };

export function managedKey(event: ExistingEvent, calendarId: string, owner: string): string | null {
  const prefix = `Cashio calendar v1:${owner}:`;
  if (event.calendarId !== calendarId || !event.notes?.startsWith(prefix)) return null;
  const key = event.notes.slice(prefix.length);
  return /^(recurring|loan)-\d+-\d+$/.test(key) ? key : null;
}

/** Only exact ownership tags qualify. Duplicate tagged events are removed, never adopted. */
export function selectSync(
  desired: readonly CalendarPayment[],
  existing: readonly ExistingEvent[],
  calendarId: string,
  owner: string,
) {
  const remaining = new Map(desired.map((payment) => [payment.key, payment]));
  const update: { id: string; payment: CalendarPayment }[] = [];
  const remove: string[] = [];
  for (const event of existing) {
    const key = managedKey(event, calendarId, owner);
    if (key === null) continue;
    const payment = remaining.get(key);
    if (payment) {
      update.push({ id: event.id, payment });
      remaining.delete(key);
    } else {
      remove.push(event.id);
    }
  }
  return { create: [...remaining.values()], update, remove };
}
