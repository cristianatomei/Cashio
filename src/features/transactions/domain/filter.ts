import type { TransactionType } from '@/core/domain/transaction';

import { transactionTitle, type TransactionView } from './views';

export type TransactionFilter = { query: string; type: 'all' | TransactionType };

/** Case-insensitive match on title, category, merchant, note and tags. */
export function filterTransactions(
  views: readonly TransactionView[],
  { query, type }: TransactionFilter,
): TransactionView[] {
  const needle = query.trim().toLowerCase();

  return views.filter((view) => {
    if (type !== 'all' && view.type !== type) return false;
    if (!needle) return true;

    const haystack = [
      transactionTitle(view),
      view.category?.name,
      view.merchant?.name,
      view.merchantRaw,
      view.note,
      ...view.tags.map((tag) => tag.name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}
