import type { TransactionType } from '@/core/domain/transaction';

import { transactionTitle, type TransactionView } from './views';

export type TransactionFilter = {
  query: string;
  type: 'all' | TransactionType;
  categoryId?: number | 'uncategorized' | null;
  groupId?: number | 'uncategorized' | null;
  accountId?: number | null;
  tagId?: number | null;
  currency?: string;
};

/** Case-insensitive match on title, category, merchant, note and tags. */
export function filterTransactions(
  views: readonly TransactionView[],
  { query, type, categoryId, groupId, accountId, tagId, currency }: TransactionFilter,
): TransactionView[] {
  const needle = query.trim().toLowerCase();

  return views.filter((view) => {
    if (currency && view.currency !== currency) return false;
    if (
      categoryId === 'uncategorized' &&
      view.category !== null &&
      !view.allocations.some((item) => item.category === null)
    )
      return false;
    if (
      groupId === 'uncategorized' &&
      view.category !== null &&
      !view.allocations.some((item) => item.category === null)
    )
      return false;
    if (
      typeof groupId === 'number' &&
      view.category?.groupId !== groupId &&
      !view.allocations.some((item) => item.category?.groupId === groupId)
    )
      return false;
    if (tagId != null && !view.tags.some((tag) => tag.id === tagId)) return false;
    if (type !== 'all' && view.type !== type) return false;
    if (
      typeof categoryId === 'number' &&
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
