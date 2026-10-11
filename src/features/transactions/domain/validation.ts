import type { TransactionType } from './types';

export type TransactionDraft = {
  type: TransactionType;
  accountId: number | null;
  transferAccountId: number | null;
  amountMinor: number | null;
  categoryId: number | null;
  allocations?: { categoryId: number | null; amountMinor: number | null }[];
};

export type ValidationError =
  | 'amount'
  | 'account'
  | 'transferAccount'
  | 'sameAccount'
  | 'category'
  | 'splitAmounts';

export function validateTransaction(draft: TransactionDraft): ValidationError | null {
  if (draft.amountMinor === null || draft.amountMinor <= 0) return 'amount';
  if (draft.type === 'transfer') {
    if (draft.accountId === null) return 'account';
    if (draft.transferAccountId === null) return 'transferAccount';
    if (draft.transferAccountId === draft.accountId) return 'sameAccount';
    return null;
  }

  if (draft.categoryId === null) return 'category';
  if (draft.allocations && draft.allocations.length > 0) {
    const validAllocations = draft.allocations.every(
      (allocation) =>
        allocation.categoryId !== null &&
        allocation.amountMinor !== null &&
        allocation.amountMinor > 0,
    );
    const allocatedMinor = draft.allocations.reduce(
      (total, allocation) => total + (allocation.amountMinor ?? 0),
      0,
    );
    if (
      draft.allocations.length < 2 ||
      !validAllocations ||
      allocatedMinor !== draft.amountMinor
    ) {
      return 'splitAmounts';
    }
  }
  return null;
}
