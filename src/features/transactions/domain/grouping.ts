import { startOfDay } from '@/core/utils/dates';

import type { TransactionStatus, TransactionType } from './types';

type Summarizable = { type: TransactionType; status: TransactionStatus; amountMinor: number };

export type DayGroup<T> = { dayStart: number; items: T[] };

/** Groups rows by calendar day, newest day first and newest row first inside a day. */
export function groupByDay<T extends { occurredAt: number }>(rows: readonly T[]): DayGroup<T>[] {
  const sorted = [...rows].sort((a, b) => b.occurredAt - a.occurredAt);
  const groups: DayGroup<T>[] = [];

  for (const row of sorted) {
    const dayStart = startOfDay(row.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.dayStart === dayStart) last.items.push(row);
    else groups.push({ dayStart, items: [row] });
  }
  return groups;
}

export type Totals = { income: number; expense: number; balance: number };

/** Transfers and drafts never count towards income or expenses. */
export function summarize(rows: readonly Summarizable[]): Totals {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.status !== 'confirmed') continue;
    if (row.type === 'income') income += row.amountMinor;
    if (row.type === 'expense') expense += row.amountMinor;
  }
  return { income, expense, balance: income - expense };
}
