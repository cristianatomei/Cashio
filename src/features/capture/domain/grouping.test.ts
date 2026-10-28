import type { TransactionView } from '@/features/transactions';

import { bucketDrafts } from './grouping';

const draft = (id: number, merchantRaw: string | null, overrides: Partial<TransactionView> = {}) =>
  ({
    id,
    type: 'expense',
    status: 'draft',
    amountMinor: 1000 * id,
    currency: 'RON',
    occurredAt: id,
    note: null,
    account: null,
    transferAccount: null,
    category: null,
    allocations: [],
    merchant: null,
    merchantRaw,
    tags: [],
    ...overrides,
  }) as TransactionView;

describe('bucketDrafts', () => {
  it('groups unknown merchants regardless of formatting and sums them', () => {
    const { unknownMerchants, others } = bucketDrafts([
      draft(1, 'GRAFRELY SRL'),
      draft(2, 'Grafrely S.R.L.'),
      draft(3, 'PECO'),
    ]);
    expect(others).toEqual([]);
    expect(unknownMerchants).toHaveLength(2);
    expect(unknownMerchants[0]).toMatchObject({ key: 'grafrely|expense|RON', totalMinor: 3000 });
    expect(unknownMerchants[0].items.map((i) => i.id)).toEqual([1, 2]);
  });

  it('keeps different currencies and income/expense separate for safe association totals', () => {
    const { unknownMerchants } = bucketDrafts([
      draft(1, 'Mega'),
      draft(2, 'Mega', { currency: 'EUR' }),
      draft(3, 'Mega', { type: 'income' }),
    ]);
    expect(unknownMerchants).toHaveLength(3);
    expect(unknownMerchants.map((group) => group.items.length)).toEqual([1, 1, 1]);
  });

  it('keeps drafts without a raw merchant, with a merchant, or transfers in "others"', () => {
    const { unknownMerchants, others } = bucketDrafts([
      draft(1, null),
      draft(2, 'X', { merchant: { id: 1, name: 'X' } }),
      draft(3, 'Y', { type: 'transfer' }),
    ]);
    expect(unknownMerchants).toEqual([]);
    expect(others.map((o) => o.id)).toEqual([1, 2, 3]);
  });
});
