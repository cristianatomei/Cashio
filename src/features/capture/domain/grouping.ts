import type { TransactionView } from '@/features/transactions';
import { normalizeMerchant } from '@/features/parsing';

export type UnknownMerchantGroup = {
  key: string;
  /** Raw name as it appeared first in a notification. */
  merchantRaw: string;
  items: TransactionView[];
  totalMinor: number;
  currency: string;
};

export type DraftBuckets = {
  unknownMerchants: UnknownMerchantGroup[];
  others: TransactionView[];
};

/** Drafts with an unrecognized merchant are grouped by name so one association fixes them all. */
export function bucketDrafts(drafts: readonly TransactionView[]): DraftBuckets {
  const groups = new Map<string, UnknownMerchantGroup>();
  const others: TransactionView[] = [];

  for (const draft of drafts) {
    if (!draft.merchant && draft.merchantRaw && draft.type !== 'transfer') {
      const key = `${normalizeMerchant(draft.merchantRaw) || draft.merchantRaw}|${draft.type}|${draft.currency}`;
      const group = groups.get(key) ?? {
        key,
        merchantRaw: draft.merchantRaw,
        items: [],
        totalMinor: 0,
        currency: draft.currency,
      };
      group.items.push(draft);
      group.totalMinor += draft.amountMinor;
      groups.set(key, group);
    } else {
      others.push(draft);
    }
  }

  return {
    unknownMerchants: [...groups.values()].sort((a, b) => b.items.length - a.items.length),
    others,
  };
}
