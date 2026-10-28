import { filterTransactions } from './filter';
import type { TransactionView } from './views';

const view = (overrides: Partial<TransactionView>): TransactionView => ({
  id: 1,
  type: 'expense',
  status: 'confirmed',
  amountMinor: 1000,
  baseAmountMinor: null,
  currency: 'RON',
  source: 'manual',
  recurringId: null,
  occurredAt: 1,
  note: null,
  account: null,
  transferAccount: null,
  category: null,
  allocations: [],
  merchant: null,
  merchantRaw: null,
  tags: [],
  ...overrides,
});

describe('filterTransactions', () => {
  const rows = [
    view({
      id: 1,
      merchant: { id: 1, name: 'Peco' },
      tags: [{ id: 1, name: 'mașină', color: null }],
    }),
    view({
      id: 2,
      type: 'income',
      account: { id: 2, name: 'ING', color: '#fff', icon: 'wallet' },
      category: {
        id: 1,
        name: 'Salariu',
        icon: 'x',
        color: '#fff',
        groupId: 1,
        groupName: 'Venituri',
      },
    }),
    view({
      id: 3,
      note: 'Cadou pentru Ana',
      account: { id: 1, name: 'Cash', color: '#000', icon: 'cash' },
      category: {
        id: 2,
        name: 'Cadouri',
        icon: 'gift',
        color: '#abc',
        groupId: 2,
        groupName: 'Dorințe',
      },
      allocations: [
        {
          amountMinor: 1000,
          category: {
            id: 2,
            name: 'Cadouri',
            icon: 'gift',
            color: '#abc',
            groupId: 2,
            groupName: 'Dorințe',
          },
        },
      ],
    }),
  ];

  it('keeps everything with no filter', () => {
    expect(filterTransactions(rows, { query: '', type: 'all' })).toHaveLength(3);
  });

  it('filters drilldown group, uncategorized, currency and tag scopes', () => {
    expect(
      filterTransactions(rows, { query: '', type: 'all', groupId: 2 }).map((row) => row.id),
    ).toEqual([3]);
    expect(
      filterTransactions(rows, { query: '', type: 'all', categoryId: 'uncategorized' }).map(
        (row) => row.id,
      ),
    ).toEqual([1]);
    expect(
      filterTransactions(rows, { query: '', type: 'all', tagId: 1 }).map((row) => row.id),
    ).toEqual([1]);
    expect(filterTransactions(rows, { query: '', type: 'all', currency: 'EUR' })).toEqual([]);
  });

  it('filters by type', () => {
    expect(filterTransactions(rows, { query: '', type: 'income' }).map((r) => r.id)).toEqual([2]);
  });

  it('searches merchant, tags, category and note', () => {
    expect(filterTransactions(rows, { query: 'peco', type: 'all' }).map((r) => r.id)).toEqual([1]);
    expect(filterTransactions(rows, { query: 'mașină', type: 'all' }).map((r) => r.id)).toEqual([
      1,
    ]);
    expect(filterTransactions(rows, { query: 'salar', type: 'all' }).map((r) => r.id)).toEqual([2]);
    expect(filterTransactions(rows, { query: 'ana', type: 'all' }).map((r) => r.id)).toEqual([3]);
  });

  it('filters by account and category, including split allocations', () => {
    expect(
      filterTransactions(rows, { query: '', type: 'all', accountId: 2 }).map((r) => r.id),
    ).toEqual([2]);
    expect(
      filterTransactions(rows, { query: '', type: 'all', categoryId: 2 }).map((r) => r.id),
    ).toEqual([3]);
  });
});
