import type { TransactionFilter } from './filter';

export type SavedFilter = TransactionFilter & { from?: string; to?: string };

export function calendarDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid calendar date.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('Invalid calendar date.');
  }
  return date.getTime();
}

export function filterDateRange(filter: SavedFilter): { from: number; to: number } | undefined {
  if (!filter.from && !filter.to) return undefined;
  if (!filter.from || !filter.to) throw new Error('Both date boundaries are required.');
  const from = localDate(filter.from);
  const end = new Date(localDate(filter.to));
  if (end.getTime() < from) throw new Error('Invalid date range.');
  end.setDate(end.getDate() + 1);
  return { from, to: end.getTime() };
}

export function parseSavedFilter(json: string): SavedFilter {
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid filter.');
  const record = value as Record<string, unknown>;
  if (
    typeof record.query !== 'string' ||
    !['all', 'expense', 'income', 'transfer'].includes(String(record.type))
  ) {
    throw new Error('Invalid filter.');
  }
  for (const key of ['categoryId', 'groupId', 'accountId', 'tagId']) {
    const id = record[key];
    if ((key === 'categoryId' || key === 'groupId') && id === 'uncategorized') continue;
    if (
      id !== undefined &&
      id !== null &&
      (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)
    ) {
      throw new Error('Invalid filter reference.');
    }
    if (
      record.currency !== undefined &&
      (typeof record.currency !== 'string' || !/^[A-Z]{3}$/.test(record.currency))
    )
      throw new Error('Invalid filter currency.');
  }
  for (const key of ['from', 'to']) {
    if (record[key] !== undefined && typeof record[key] !== 'string')
      throw new Error('Invalid filter date.');
  }
  const filter = record as SavedFilter;
  filterDateRange(filter);
  return filter;
}
