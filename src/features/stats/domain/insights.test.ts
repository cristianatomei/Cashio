import { expense } from './fixtures.test-helper';
import { detectSpendingInsights } from './insights';

const now = new Date(2026, 9, 20).getTime();
const three = [expense(7), expense(8), expense(9)];

describe('spending suggestions', () => {
  it('suggests a subscription after one equal payment in three consecutive months', () => {
    expect(detectSpendingInsights(three, now)).toEqual([
      expect.objectContaining({
        kind: 'subscription',
        amountMinor: 1000,
        baselineMinor: 1000,
        transactionIds: [8, 9, 10],
      }),
    ]);
  });

  it('is deterministic without mutating input or depending on query order', () => {
    const frozen = three.map((row) => Object.freeze(row));
    expect(detectSpendingInsights(Object.freeze(frozen), now)).toEqual(
      detectSpendingInsights([...three].reverse(), now),
    );
  });

  it('does not turn existing obligations or several purchases per month into subscriptions', () => {
    expect(
      detectSpendingInsights(
        three.map((row) => ({ ...row, recurringId: 1 })),
        now,
      ),
    ).toEqual([]);
    expect(detectSpendingInsights([...three, expense(8, { id: 99 })], now)).toEqual([]);
  });

  it('requires consecutive months, a merchant and current-month evidence', () => {
    expect(detectSpendingInsights([expense(5), expense(7), expense(9)], now)).toEqual([]);
    expect(detectSpendingInsights([expense(6), expense(7), expense(8)], now)).toEqual([]);
    expect(
      detectSpendingInsights(
        three.map((row) => ({ ...row, merchant: null })),
        now,
      ),
    ).toEqual([]);
  });

  it('never mixes currencies or merchants even with equal converted amounts', () => {
    expect(
      detectSpendingInsights(
        [expense(7), expense(8, { currency: 'EUR', baseAmountMinor: 1000 }), expense(9)],
        now,
      ),
    ).toEqual([]);
    expect(
      detectSpendingInsights(
        [expense(7), expense(8, { merchant: { id: 2, name: 'Service' } }), expense(9)],
        now,
      ),
    ).toEqual([]);
  });

  it.each([
    { type: 'transfer' as const },
    { type: 'income' as const },
    { amountMinor: -1000 },
    { amountMinor: 0 },
    { status: 'draft' as const },
    { occurredAt: now + 1 },
  ])('excludes transfers, refunds, drafts and future transactions: %j', (overrides) => {
    expect(detectSpendingInsights([expense(7), expense(8), expense(9, overrides)], now)).toEqual(
      [],
    );
  });

  it('detects an increase only above 5%, after three stable monthly payments', () => {
    const history = [expense(6), expense(7), expense(8)];
    expect(detectSpendingInsights([...history, expense(9, { amountMinor: 1050 })], now)).toEqual(
      [],
    );
    expect(detectSpendingInsights([...history, expense(9, { amountMinor: 1051 })], now)).toEqual([
      expect.objectContaining({ kind: 'priceIncrease', baselineMinor: 1000, amountMinor: 1051 }),
    ]);
    expect(
      detectSpendingInsights([...history.slice(1), expense(9, { amountMinor: 1051 })], now),
    ).toEqual([]);
  });

  it('flags unusual purchases against three months of merchant history, without duplicate increase alerts', () => {
    const history = [
      expense(6, { amountMinor: 900 }),
      expense(7),
      expense(8, { amountMinor: 1100 }),
    ];
    expect(detectSpendingInsights([...history, expense(9, { amountMinor: 2000 })], now)).toEqual([
      expect.objectContaining({ kind: 'unusual', baselineMinor: 1000 }),
    ]);
    expect(detectSpendingInsights([...history, expense(9, { amountMinor: 1999 })], now)).toEqual(
      [],
    );
    expect(
      detectSpendingInsights(
        [expense(6), expense(7), expense(8), expense(9, { amountMinor: 3000 })],
        now,
      ),
    ).toEqual([expect.objectContaining({ kind: 'priceIncrease' })]);
  });

  it('normalizes raw merchant whitespace and case and handles the year boundary', () => {
    const rows = [10, 11, 12].map((month) =>
      expense(month, {
        merchant: null,
        merchantRaw: month === 11 ? '  SERVICE  ' : 'Service',
      }),
    );
    expect(detectSpendingInsights(rows, new Date(2027, 0, 20).getTime())).toEqual([
      expect.objectContaining({ kind: 'subscription' }),
    ]);
  });
});
