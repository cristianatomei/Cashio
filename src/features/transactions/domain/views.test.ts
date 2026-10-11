import { composeTransactionViews, transactionTitle } from './views';

const accounts = [
  { id: 1, name: 'ING', color: '#FF6200', icon: 'bank' },
  { id: 2, name: 'Cash', color: '#2DD4BF', icon: 'wallet-outline' },
];
const groups = [{ id: 10, name: 'Vicii', color: '#FF5C8A' }];
const categories = [{ id: 100, groupId: 10, name: 'Țigări', icon: 'smoking' }];
const merchants = [{ id: 7, name: 'Peco' }];
const tags = [{ id: 5, name: 'mașină', color: null }];

const base = {
  status: 'confirmed',
  currency: 'RON',
  source: 'manual',
  recurringId: null,
  transferAccountId: null,
  categoryId: null,
  merchantId: null,
  merchantRaw: null,
  note: null,
  occurredAt: 1,
} as const;

describe('composeTransactionViews', () => {
  const compose = (transactions: Parameters<typeof composeTransactionViews>[0]['transactions']) =>
    composeTransactionViews({
      transactions,
      accounts,
      groups,
      categories,
      merchants,
      tags,
      tagLinks: [{ transactionId: 1, tagId: 5 }],
    });

  it('resolves category color from its group, plus merchant, account and tags', () => {
    const [view] = compose([
      {
        ...base,
        id: 1,
        type: 'expense',
        accountId: 1,
        amountMinor: 5200,
        categoryId: 100,
        merchantId: 7,
      },
    ]);
    expect(view.category).toEqual({
      id: 100,
      name: 'Țigări',
      icon: 'smoking',
      color: '#FF5C8A',
      groupId: 10,
      groupName: 'Vicii',
    });
    expect(view.account?.name).toBe('ING');
    expect(view.merchant?.name).toBe('Peco');
    expect(view.tags.map((t) => t.name)).toEqual(['mașină']);
    expect(transactionTitle(view)).toBe('Peco');
  });

  it('titles transfers with both accounts', () => {
    const [view] = compose([
      { ...base, id: 2, type: 'transfer', accountId: 1, transferAccountId: 2, amountMinor: 20000 },
    ]);
    expect(transactionTitle(view)).toBe('ING → Cash');
    expect(view.category).toBeNull();
  });

  it('falls back to the category name when there is no merchant', () => {
    const [view] = compose([
      { ...base, id: 3, type: 'expense', accountId: 1, amountMinor: 100, categoryId: 100 },
    ]);
    expect(transactionTitle(view)).toBe('Țigări');
  });
});
