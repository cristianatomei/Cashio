type MonthlyTransaction = {
  type: string;
  status: string;
  currency: string;
  amountMinor: number;
  occurredAt: number;
};

/** Cash flow, not account balances: transfers and drafts must never change this figure. */
export function monthlyCashFlow(rows: MonthlyTransaction[], now: number): [string, number][] {
  const date = new Date(now);
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  const amounts = new Map<string, number>();
  for (const row of rows) {
    if (
      row.status !== 'confirmed' ||
      !['expense', 'income'].includes(row.type) ||
      row.occurredAt < start ||
      row.occurredAt >= end
    )
      continue;
    amounts.set(
      row.currency,
      (amounts.get(row.currency) ?? 0) + row.amountMinor * (row.type === 'expense' ? -1 : 1),
    );
  }
  return [...amounts].sort(([a], [b]) => a.localeCompare(b));
}

export function positiveId(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function captureRoute(
  id: unknown,
): { pathname: '/add-transaction'; params: { id: string } } | null {
  const valid = positiveId(id);
  return valid === null ? null : { pathname: '/add-transaction', params: { id: String(valid) } };
}

export const CAPTURE_DAILY_LIMIT = 5;
export const NOTIFICATION_LIMIT = 50;

export function canNotifyCapture(daily: number, scheduled: number, presented: number): boolean {
  return daily < CAPTURE_DAILY_LIMIT && scheduled + presented < NOTIFICATION_LIMIT;
}

export function frequentCategories(
  transactions: { type: string; categoryId: number | null }[],
  categories: { id: number; name: string }[],
): { id: number; name: string }[] {
  const counts = new Map<number, number>();
  for (const row of transactions) {
    if (row.type === 'expense' && row.categoryId !== null) {
      counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
    }
  }
  return categories
    .filter((category) => counts.has(category.id))
    .sort((a, b) => counts.get(b.id)! - counts.get(a.id)! || a.id - b.id)
    .slice(0, 2);
}
