import { advanceRecurringDate } from './forecast';

export type ScheduledRecurringRule = {
  id: number;
  name: string;
  amountMinor: number;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  nextDue: number;
  endAt: number | null;
  active: boolean;
};

export type ScheduledRecurringPayment = {
  key: string;
  name: string;
  dueAt: number;
  amountMinor: number;
  currency: string;
};

export function recurringPaymentsInRange(
  rules: readonly ScheduledRecurringRule[],
  from: number,
  to: number,
): ScheduledRecurringPayment[] {
  if (from >= to) return [];

  const payments: ScheduledRecurringPayment[] = [];
  for (const rule of rules) {
    if (!rule.active || rule.interval < 1 || rule.amountMinor <= 0 || !rule.currency) continue;

    let dueAt = rule.nextDue;
    while (dueAt < from && (rule.endAt === null || dueAt <= rule.endAt)) {
      const nextDue = advanceRecurringDate(dueAt, rule.frequency, rule.interval);
      if (nextDue <= dueAt) break;
      dueAt = nextDue;
    }

    while (dueAt < to && (rule.endAt === null || dueAt <= rule.endAt)) {
      if (dueAt >= from) {
        payments.push({
          key: `recurring-${rule.id}-${dueAt}`,
          name: rule.name,
          dueAt,
          amountMinor: rule.amountMinor,
          currency: rule.currency,
        });
      }
      const nextDue = advanceRecurringDate(dueAt, rule.frequency, rule.interval);
      if (nextDue <= dueAt) break;
      dueAt = nextDue;
    }
  }

  return payments.sort(
    (left, right) => left.dueAt - right.dueAt || left.key.localeCompare(right.key),
  );
}
