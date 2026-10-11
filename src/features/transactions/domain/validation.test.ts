import { validateTransaction, type TransactionDraft } from './validation';

const valid: TransactionDraft = {
  type: 'expense',
  accountId: 1,
  transferAccountId: null,
  amountMinor: 1500,
  categoryId: 4,
};

describe('validateTransaction', () => {
  it('accepts a complete expense', () => {
    expect(validateTransaction(valid)).toBeNull();
  });

  it('rejects missing or non-positive amounts', () => {
    expect(validateTransaction({ ...valid, amountMinor: null })).toBe('amount');
    expect(validateTransaction({ ...valid, amountMinor: 0 })).toBe('amount');
  });

  it('allows expenses and income without an account but requires a category', () => {
    expect(validateTransaction({ ...valid, accountId: null })).toBeNull();
    expect(validateTransaction({ ...valid, categoryId: null })).toBe('category');
    expect(validateTransaction({ ...valid, type: 'income', categoryId: null })).toBe('category');
  });

  it('validates transfers by their two accounts, without a category', () => {
    const transfer: TransactionDraft = {
      ...valid,
      type: 'transfer',
      categoryId: null,
      transferAccountId: 2,
    };
    expect(validateTransaction(transfer)).toBeNull();
    expect(validateTransaction({ ...transfer, accountId: null })).toBe('account');
    expect(validateTransaction({ ...transfer, transferAccountId: null })).toBe('transferAccount');
    expect(validateTransaction({ ...transfer, transferAccountId: 1 })).toBe('sameAccount');
  });

  it('requires split category amounts to be positive and add up to the transaction', () => {
    expect(
      validateTransaction({
        ...valid,
        categoryId: 4,
        allocations: [
          { categoryId: 4, amountMinor: 500 },
          { categoryId: 5, amountMinor: 1000 },
        ],
      }),
    ).toBeNull();
    expect(
      validateTransaction({
        ...valid,
        allocations: [
          { categoryId: 4, amountMinor: 500 },
          { categoryId: 5, amountMinor: 500 },
        ],
      }),
    ).toBe('splitAmounts');
  });
});
