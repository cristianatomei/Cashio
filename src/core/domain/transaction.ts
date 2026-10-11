export type TransactionType = 'expense' | 'income' | 'transfer';

export type TransactionStatus = 'draft' | 'confirmed';

export const TRANSACTION_TYPES: readonly TransactionType[] = ['expense', 'income', 'transfer'];
