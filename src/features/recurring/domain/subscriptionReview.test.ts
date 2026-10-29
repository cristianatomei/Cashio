import { expense } from '@/features/stats/domain/fixtures.test-helper';
import { detectSpendingInsights } from '@/features/stats/domain/insights';
import type { RecurringRule } from '../data/recurringRepo';
import {
  confirmedRecurringTotals,
  existingSubscription,
  parseSubscriptionReviews,
  reviewKey,
  subscriptionPrefill,
} from './subscriptionReview';

const now = new Date(2026, 9, 20).getTime();
const evidence = [expense(7), expense(8), expense(9)];
const insight = detectSpendingInsights(evidence, now)[0];
const suggestion = { insight, evidence };
const rule: RecurringRule = {
  id: 1,
  accountId: 1,
  merchantId: 1,
  categoryId: null,
  type: 'expense',
  amountMinor: 1000,
  currency: 'RON',
  frequency: 'monthly',
  interval: 1,
  nextDue: now,
  endAt: null,
  active: true,
  amountVariable: false,
  autoPost: false,
  createdAt: now,
  note: 'Service',
};

it('prefills only a monthly hypothesis and no category, never writes or mutates evidence', () => {
  const original = JSON.stringify(evidence);
  expect(subscriptionPrefill(suggestion, now)).toEqual({
    type: 'expense',
    note: 'Service',
    merchantId: 1,
    categoryId: null,
    amountMinor: 1000,
    amountVariable: false,
    currency: 'RON',
    frequency: 'monthly',
    interval: 1,
    nextDue: new Date(2026, 10, 5).getTime(),
  });
  expect(JSON.stringify(evidence)).toBe(original);
  expect(
    subscriptionPrefill(
      {
        insight: { ...insight, kind: 'priceIncrease', amountMinor: 1200 },
        evidence,
      },
      now,
    ),
  ).toMatchObject({ amountMinor: 1200, amountVariable: true });
});

it('uses one stable review identity across subscription and price-increase suggestions', () => {
  expect(reviewKey(insight)).toBe(
    reviewKey({
      ...insight,
      id: insight.id.replace('subscription:', 'priceIncrease:'),
    }),
  );
});

it('matches merchant identity despite price, account, interval or active changes', () => {
  expect(
    existingSubscription(
      suggestion,
      [
        {
          ...rule,
          active: false,
          accountId: 2,
          amountMinor: 5555,
          interval: 2,
        },
      ],
      [],
    ),
  ).toBe(1);
  expect(
    existingSubscription(suggestion, [{ ...rule, merchantId: 9, note: 'Other' }], []),
  ).toBeNull();
  expect(existingSubscription(suggestion, [{ ...rule, currency: 'EUR' }], [])).toBeNull();
  expect(existingSubscription(suggestion, [{ ...rule, type: 'income' }], [])).toBeNull();
});

it('matches raw merchant names and any evidence already linked to a different rule', () => {
  const raw = {
    ...suggestion,
    evidence: evidence.map((row) => ({ ...row, merchant: null, merchantRaw: ' Service ' })),
  };
  expect(existingSubscription(raw, [{ ...rule, merchantId: null, note: ' SERVICE ' }], [])).toBe(1);
  expect(
    existingSubscription(
      {
        ...raw,
        evidence: [{ ...raw.evidence[0], recurringId: 3 }],
      },
      [{ ...rule, id: 3, merchantId: 9, note: 'Other', currency: 'EUR' }],
      [],
    ),
  ).toBe(3);
});

it('remembers confirmed sources even after editing the rule but permits re-review after deletion', () => {
  const reviews = [
    { key: reviewKey(insight), merchant: 'Service', currency: 'RON', ignored: false, ruleId: 3 },
  ];
  expect(
    existingSubscription(
      suggestion,
      [{ ...rule, id: 3, merchantId: null, note: 'Renamed' }],
      reviews,
    ),
  ).toBe(3);
  expect(existingSubscription(suggestion, [], reviews)).toBeNull();
});

it('normalizes confirmed expenses per currency, interval and frequency, excluding inactive/income/expired', () => {
  expect(
    confirmedRecurringTotals(
      [
        rule,
        { ...rule, id: 2, amountMinor: 12000, frequency: 'yearly' },
        { ...rule, id: 3, amountMinor: 600, interval: 3, currency: 'EUR' },
        { ...rule, id: 4, amountMinor: 1, frequency: 'daily', currency: 'USD' },
        { ...rule, id: 5, amountMinor: 7, frequency: 'weekly', currency: 'USD' },
        { ...rule, id: 6, active: false },
        { ...rule, id: 7, type: 'income' },
        { ...rule, id: 8, endAt: now - 1 },
        { ...rule, id: 9, interval: 0 },
      ],
      now,
    ),
  ).toEqual([
    { currency: 'EUR', monthlyMinor: 200, annualMinor: 2400 },
    { currency: 'RON', monthlyMinor: 2000, annualMinor: 24000 },
    { currency: 'USD', monthlyMinor: 61, annualMinor: 730 },
  ]);
});

it('validates versionless settings and rejects malformed/duplicate reviews', () => {
  const reviews = [
    { key: reviewKey(insight), merchant: 'Service', currency: 'RON', ignored: true, ruleId: null },
  ];
  expect(parseSubscriptionReviews(JSON.stringify(reviews))).toEqual(reviews);
  for (const value of [
    '{}',
    '[null]',
    JSON.stringify([...reviews, ...reviews]),
    JSON.stringify([{ ...reviews[0], ruleId: -1 }]),
  ]) {
    expect(() => parseSubscriptionReviews(value)).toThrow();
  }
});
