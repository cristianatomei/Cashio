import type { TransactionType } from '@/core/domain/transaction';

import { transactionTitle, type TransactionView } from './views';

export type TransactionFilter = {
  query: string;
  type: 'all' | TransactionType;
  categoryId?: number | null;
  accountId?: number | null;
};

/** Case-insensitive match on title, category, merchant, note and tags. */
export function filterTransactions(
  views: readonly TransactionView[],
  { query, type, categoryId, accountId }: TransactionFilter,
): TransactionView[] {
  const needle = query.trim().toLowerCase();

  return views.filter((view) => {
    if (type !== 'all' && view.type !== type) return false;
    if (
      categoryId !== null &&
      categoryId !== undefined &&
      view.category?.id !== categoryId &&
      !view.allocations.some((allocation) => allocation.category?.id === categoryId)
    ) {
      return false;
    }
    if (
      accountId !== null &&
      accountId !== undefined &&
      view.account?.id !== accountId &&
      view.transferAccount?.id !== accountId
    ) {
      return false;
    }
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
