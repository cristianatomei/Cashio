import { calculateBudgetUsage, crossedBudgetThresholds } from './budget';

const monthFrom = new Date(2026, 9, 1).getTime();

const budget = {
  id: 1,
  categoryId: 10,
  groupId: null,
  amountMinor: 10000,
  currency: 'RON',
  rollover: false,
  createdAt: new Date(2026, 8, 1).getTime(),
};

describe('calculateBudgetUsage', () => {
  it('counts only confirmed expenses in the budget category, currency and month', () => {
    const usage = calculateBudgetUsage(
      budget,
      [
        {
          categoryId: 10,
          type: 'expense',
          status: 'confirmed',
          amountMinor: 8000,
          currency: 'RON',
          occurredAt: new Date(2026, 9, 3).getTime(),
        },
        {
          categoryId: 10,
          type: 'income',
          status: 'confirmed',
          amountMinor: 10000,
          currency: 'RON',
          occurredAt: new Date(2026, 9, 4).getTime(),
        },
        {
          categoryId: 10,
          type: 'expense',
          status: 'draft',
          amountMinor: 3000,
          currency: 'RON',
          occurredAt: new Date(2026, 9, 5).getTime(),
        },
        {
          categoryId: 11,
          type: 'expense',
          status: 'confirmed',
          amountMinor: 9000,
          currency: 'RON',
          occurredAt: new Date(2026, 9, 5).getTime(),
        },
        {
          categoryId: 10,
          type: 'expense',
          status: 'confirmed',
          amountMinor: 9000,
          currency: 'EUR',
          occurredAt: new Date(2026, 9, 6).getTime(),
        },
        {
          categoryId: 10,
          type: 'expense',
          status: 'confirmed',
          amountMinor: 5000,
          currency: 'RON',
          occurredAt: new Date(2026, 8, 30).getTime(),
        },
      ],
      new Map([
        [10, 5],
        [11, 5],
      ]),
      monthFrom,
    );
    expect(usage.spentMinor).toBe(8000);
    expect(usage.progress).toBe(0.8);
  });

  it('carries unused funds forward when rollover is enabled', () => {
    const usage = calculateBudgetUsage(
      { ...budget, rollover: true },
      [
        {
          categoryId: 10,
          type: 'expense',
          status: 'confirmed',
          amountMinor: 4000,
          currency: 'RON',
          occurredAt: new Date(2026, 8, 10).getTime(),
        },
      ],
      new Map([[10, 5]]),
      monthFrom,
    );
    expect(usage.carriedMinor).toBe(6000);
    expect(usage.limitMinor).toBe(16000);
  });
});

describe('crossedBudgetThresholds', () => {
  it('returns each reached threshold once', () => {
    const usage = calculateBudgetUsage(budget, [], new Map(), monthFrom);
    expect(crossedBudgetThresholds({ ...usage, spentMinor: 10000 }, [])).toEqual([80, 100]);
    expect(crossedBudgetThresholds({ ...usage, spentMinor: 10000 }, [80])).toEqual([100]);
  });
});
