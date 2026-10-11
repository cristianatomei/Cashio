import type { TransactionStatus, TransactionType } from '@/core/domain/transaction';

type BalanceTransaction = {
  accountId: number | null;
  type: TransactionType;
  status: TransactionStatus;
  amountMinor: number;
  transferAccountId: number | null;
  transferAmountMinor: number | null;
};

/** Opening balance plus confirmed movements, keyed by account id. */
export function computeBalances(
  accounts: readonly { id: number; openingBalanceMinor: number }[],
  transactions: readonly BalanceTransaction[],
): Map<number, number> {
  const balances = new Map<number, number>(accounts.map((a) => [a.id, a.openingBalanceMinor]));
  const add = (accountId: number, delta: number) => {
    if (balances.has(accountId)) balances.set(accountId, (balances.get(accountId) ?? 0) + delta);
  };

  for (const tx of transactions) {
    if (tx.status !== 'confirmed') continue;
    if (tx.type === 'income' && tx.accountId !== null) add(tx.accountId, tx.amountMinor);
    else if (tx.type === 'expense' && tx.accountId !== null) add(tx.accountId, -tx.amountMinor);
    else {
      if (tx.accountId !== null) add(tx.accountId, -tx.amountMinor);
      if (tx.transferAccountId !== null) {
        add(tx.transferAccountId, tx.transferAmountMinor ?? tx.amountMinor);
      }
    }
  }
  return balances;
}
