import type { TransactionView } from '@/features/transactions';

import { calculateAnalytics, rangeForPreset } from './analytics';

const range = {
  from: new Date(2026, 9, 1).getTime(),
  to: new Date(2026, 10, 1).getTime(),
};

const row = {
  status: 'confirmed',
  currency: 'RON',
  source: 'manual',
  recurringId: null,
  baseAmountMinor: null,
  occurredAt: new Date(2026, 9, 10).getTime(),
  note: null,
  account: null,
  transferAccount: null,
  category: {
    id: 1,
    name: 'Utilități',
    icon: 'flash',
    color: '#0F766E',
    groupId: 2,
    groupName: 'Casă',
  },
  allocations: [
    {
      amountMinor: 1,
      category: {
        id: 1,
        name: 'Utilități',
        icon: 'flash',
        color: '#0F766E',
        groupId: 2,
        groupName: 'Casă',
      },
    },
  ],
  merchant: { id: 1, name: 'Furnizor' },
  merchantRaw: null,
  tags: [] as TransactionView['tags'],
} as const;

describe('calculateAnalytics', () => {
  it('aggregates confirmed income, expenses, category groups and recurring expenses per currency', () => {
    const result = calculateAnalytics(
      [
        { ...row, id: 1, type: 'expense', amountMinor: 2500 },
        { ...row, id: 2, type: 'expense', amountMinor: 7500, recurringId: 4 },
        { ...row, id: 3, type: 'income', amountMinor: 20000 },
        { ...row, id: 4, type: 'transfer', amountMinor: 9000 },
        { ...row, id: 5, type: 'expense', amountMinor: 6000, currency: 'EUR' },
        { ...row, id: 6, type: 'expense', amountMinor: 10000, status: 'draft' },
      ],
      range,
      'RON',
    );

    expect(result.incomeMinor).toBe(20000);
    expect(result.expenseMinor).toBe(10000);
    expect(result.balanceMinor).toBe(10000);
    expect(result.obligationsMinor).toBe(7500);
    expect(result.obligationCount).toBe(1);
    expect(result.unconvertedCount).toBe(1);
    expect(result.groups).toEqual([
      { id: '2', label: 'Casă', amountMinor: 10000, color: '#0F766E' },
    ]);
    expect(result.categories[0].amountMinor).toBe(10000);
    expect(result.merchants[0].label).toBe('Furnizor');
    expect(result.trend.reduce((total, bucket) => total + bucket.expenseMinor, 0)).toBe(10000);
  });

  it('includes foreign-currency activity in base-currency totals only when a stored rate exists', () => {
    const result = calculateAnalytics(
      [
        {
          ...row,
          id: 1,
          type: 'expense',
          amountMinor: 1000,
          currency: 'EUR',
          baseAmountMinor: 3500,
        },
        { ...row, id: 2, type: 'income', amountMinor: 500, currency: 'EUR', baseAmountMinor: null },
      ],
      range,
      'RON',
    );
    expect(result.expenseMinor).toBe(3500);
    expect(result.incomeMinor).toBe(0);
    expect(result.unconvertedCount).toBe(1);
  });
});

describe('rangeForPreset', () => {
  it('creates calendar-aligned rolling and year ranges', () => {
    const now = new Date(2026, 9, 10, 12).getTime();
    expect(rangeForPreset('quarter', now)).toEqual({
      from: new Date(2026, 7, 1).getTime(),
      to: new Date(2026, 10, 1).getTime(),
    });
    expect(rangeForPreset('year', now)).toEqual({
      from: new Date(2026, 0, 1).getTime(),
      to: new Date(2027, 0, 1).getTime(),
    });
  });
});
