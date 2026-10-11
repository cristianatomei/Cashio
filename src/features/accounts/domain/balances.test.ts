import { computeBalances } from './balances';

const base = {
  status: 'confirmed',
  transferAccountId: null,
  transferAmountMinor: null,
} as const;

describe('computeBalances', () => {
  const accounts = [
    { id: 1, openingBalanceMinor: 100000 },
    { id: 2, openingBalanceMinor: 0 },
  ];

  it('applies income and expenses to one account', () => {
    const balances = computeBalances(accounts, [
      { ...base, accountId: 1, type: 'income', amountMinor: 50000 },
      { ...base, accountId: 1, type: 'expense', amountMinor: 12000 },
    ]);
    expect(balances.get(1)).toBe(138000);
    expect(balances.get(2)).toBe(0);
  });

  it('moves money between accounts on a transfer (ATM withdrawal)', () => {
    const balances = computeBalances(accounts, [
      { ...base, accountId: 1, type: 'transfer', amountMinor: 20000, transferAccountId: 2 },
    ]);
    expect(balances.get(1)).toBe(80000);
    expect(balances.get(2)).toBe(20000);
  });

  it('uses the destination amount when currencies differ', () => {
    const balances = computeBalances(accounts, [
      {
        ...base,
        accountId: 1,
        type: 'transfer',
        amountMinor: 50000,
        transferAccountId: 2,
        transferAmountMinor: 10000,
      },
    ]);
    expect(balances.get(2)).toBe(10000);
  });

  it('ignores drafts', () => {
    const balances = computeBalances(accounts, [
      { ...base, status: 'draft', accountId: 1, type: 'expense', amountMinor: 999 },
    ]);
    expect(balances.get(1)).toBe(100000);
  });
});
