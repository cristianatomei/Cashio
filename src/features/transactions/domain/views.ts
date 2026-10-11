import type { TransactionStatus, TransactionType } from './types';

type AccountRecord = { id: number; name: string; color: string; icon: string };
type GroupRecord = { id: number; name: string; color: string };
type CategoryRecord = { id: number; groupId: number; name: string; icon: string };
type MerchantRecord = { id: number; name: string };
type TagRecord = { id: number; name: string; color: string | null };

type TransactionRecord = {
  id: number;
  type: TransactionType;
  status: TransactionStatus;
  accountId: number | null;
  transferAccountId: number | null;
  amountMinor: number;
  baseAmountMinor?: number | null;
  currency: string;
  source: string;
  recurringId: number | null;
  categoryId: number | null;
  merchantId: number | null;
  merchantRaw: string | null;
  note: string | null;
  occurredAt: number;
};

type AllocationRecord = { transactionId: number; categoryId: number | null; amountMinor: number };
type CategoryView = {
  id: number;
  name: string;
  icon: string;
  color: string;
  groupId: number;
  groupName: string;
};

export type TransactionView = {
  id: number;
  type: TransactionType;
  status: TransactionStatus;
  amountMinor: number;
  baseAmountMinor: number | null;
  currency: string;
  occurredAt: number;
  source: string;
  recurringId: number | null;
  note: string | null;
  account: AccountRecord | null;
  transferAccount: AccountRecord | null;
  category: CategoryView | null;
  allocations: readonly { amountMinor: number; category: CategoryView | null }[];
  merchant: MerchantRecord | null;
  merchantRaw: string | null;
  tags: TagRecord[];
};

type Sources = {
  transactions: readonly TransactionRecord[];
  accounts: readonly AccountRecord[];
  groups: readonly GroupRecord[];
  categories: readonly CategoryRecord[];
  merchants: readonly MerchantRecord[];
  tags: readonly TagRecord[];
  tagLinks: readonly { transactionId: number; tagId: number }[];
  allocations?: readonly AllocationRecord[];
};

const FALLBACK_COLOR = '#94A3B8';

/** Resolves ids into names, colors and icons so screens never join tables themselves. */
export function composeTransactionViews(sources: Sources): TransactionView[] {
  const accounts = new Map(sources.accounts.map((a) => [a.id, a]));
  const groups = new Map(sources.groups.map((g) => [g.id, g]));
  const categories = new Map(sources.categories.map((c) => [c.id, c]));
  const merchants = new Map(sources.merchants.map((m) => [m.id, m]));
  const tags = new Map(sources.tags.map((t) => [t.id, t]));

  const tagsByTransaction = new Map<number, TagRecord[]>();
  const allocationsByTransaction = new Map<number, AllocationRecord[]>();
  for (const allocation of sources.allocations ?? []) {
    allocationsByTransaction.set(allocation.transactionId, [
      ...(allocationsByTransaction.get(allocation.transactionId) ?? []),
      allocation,
    ]);
  }
  for (const link of sources.tagLinks) {
    const tag = tags.get(link.tagId);
    if (!tag) continue;
    tagsByTransaction.set(link.transactionId, [
      ...(tagsByTransaction.get(link.transactionId) ?? []),
      tag,
    ]);
  }

  return sources.transactions.map((tx) => {
    const categoryView = (categoryId: number | null): CategoryView | null => {
      if (categoryId === null) return null;
      const item = categories.get(categoryId);
      if (!item) return null;
      return {
        id: item.id,
        name: item.name,
        icon: item.icon,
        color: groups.get(item.groupId)?.color ?? FALLBACK_COLOR,
        groupId: item.groupId,
        groupName: groups.get(item.groupId)?.name ?? '',
      };
    };
    const categoryAllocations = allocationsByTransaction.get(tx.id);
    const resolvedAllocations =
      tx.type === 'transfer'
        ? []
        : (categoryAllocations?.map((allocation) => ({
            amountMinor: allocation.amountMinor,
            category: categoryView(allocation.categoryId),
          })) ?? [
            {
              amountMinor: tx.amountMinor,
              category: categoryView(tx.categoryId),
            },
          ]);
    return {
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amountMinor: tx.amountMinor,
      baseAmountMinor: tx.baseAmountMinor ?? null,
      currency: tx.currency,
      occurredAt: tx.occurredAt,
      source: tx.source,
      recurringId: tx.recurringId,
      note: tx.note,
      account: tx.accountId === null ? null : (accounts.get(tx.accountId) ?? null),
      transferAccount:
        tx.transferAccountId === null ? null : (accounts.get(tx.transferAccountId) ?? null),
      category: categoryView(tx.categoryId) ?? resolvedAllocations[0]?.category ?? null,
      allocations: resolvedAllocations,
      merchant: tx.merchantId === null ? null : (merchants.get(tx.merchantId) ?? null),
      merchantRaw: tx.merchantRaw,
      tags: tagsByTransaction.get(tx.id) ?? [],
    };
  });
}

/** Main line shown in lists: merchant first, then category, then the accounts of a transfer. */
export function transactionTitle(view: TransactionView): string {
  if (view.type === 'transfer') {
    return `${view.account?.name ?? '?'} → ${view.transferAccount?.name ?? '?'}`;
  }
  return view.merchant?.name ?? view.category?.name ?? view.merchantRaw ?? '?';
}
