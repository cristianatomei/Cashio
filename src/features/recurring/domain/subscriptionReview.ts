import type { SpendingInsight } from '@/features/stats/domain/insights';
import type { TransactionView } from '@/features/transactions';
import type { RecurringInput, RecurringRule } from '../data/recurringRepo';
import { advanceRecurringDate } from './forecast';

export const SUBSCRIPTION_REVIEWS_KEY = 'subscription_reviews';

export type SubscriptionReview = {
  key: string;
  merchant: string;
  currency: string;
  ignored: boolean;
  ruleId: number | null;
};

export type SubscriptionSuggestion = {
  insight: SpendingInsight;
  evidence: readonly TransactionView[];
};

export function reviewKey(insight: SpendingInsight): string {
  return insight.id.slice(insight.id.indexOf(':') + 1);
}

export function parseSubscriptionReviews(value: string): SubscriptionReview[] {
  const rows: unknown = JSON.parse(value);
  const keys = new Set<string>();
  if (
    !Array.isArray(rows) ||
    !rows.every((row) => {
      if (
        !row ||
        typeof row.key !== 'string' ||
        !row.key ||
        keys.has(row.key) ||
        typeof row.merchant !== 'string' ||
        !row.merchant.trim() ||
        typeof row.currency !== 'string' ||
        !/^[A-Z]{3}$/.test(row.currency) ||
        typeof row.ignored !== 'boolean' ||
        (row.ruleId !== null && (!Number.isSafeInteger(row.ruleId) || row.ruleId <= 0))
      )
        return false;
      keys.add(row.key);
      return true;
    })
  )
    throw new Error('Invalid subscription reviews');
  return rows;
}

const normalize = (value: string | null | undefined) => value?.trim().toLocaleLowerCase('en');

type MatchRule = RecurringRule & {
  merchantName?: string | null;
};

/** Match identity, not price: an increase or an inactive rule must not create a duplicate. */
export function existingSubscription(
  suggestion: SubscriptionSuggestion,
  rules: readonly MatchRule[],
  reviews: readonly SubscriptionReview[],
): number | null {
  const { insight, evidence } = suggestion;
  const reviewedId = reviews.find((row) => row.key === reviewKey(insight))?.ruleId;
  const linkedIds = evidence.flatMap((row) => (row.recurringId === null ? [] : [row.recurringId]));
  const merchantIds = evidence.flatMap((row) => (row.merchant ? [row.merchant.id] : []));
  return (
    rules.find(
      (rule) =>
        rule.id === reviewedId ||
        linkedIds.includes(rule.id) ||
        (rule.type === 'expense' &&
          rule.currency === insight.currency &&
          ((rule.merchantId !== null && merchantIds.includes(rule.merchantId)) ||
            normalize(rule.merchantName) === normalize(insight.merchant) ||
            normalize(rule.note) === normalize(insight.merchant))),
    )?.id ?? null
  );
}

export function subscriptionPrefill(
  { insight, evidence }: SubscriptionSuggestion,
  now: number,
): Partial<RecurringInput> {
  const latest = [...evidence].sort((a, b) => b.occurredAt - a.occurredAt || b.id - a.id)[0];
  let nextDue = advanceRecurringDate(latest?.occurredAt ?? now, 'monthly', 1);
  while (nextDue <= now) nextDue = advanceRecurringDate(nextDue, 'monthly', 1);
  return {
    ...(latest?.account ? { accountId: latest.account.id } : {}),
    type: 'expense',
    note: insight.merchant,
    merchantId: latest?.merchant?.id ?? null,
    categoryId: null,
    amountMinor: insight.amountMinor,
    amountVariable: insight.kind === 'priceIncrease',
    currency: insight.currency,
    frequency: 'monthly',
    interval: 1,
    nextDue,
  };
}

/** Annualized run rate, not a calendar forecast; round only after summing each currency. */
export function confirmedRecurringTotals(
  rules: readonly RecurringRule[],
  now: number,
): { currency: string; monthlyMinor: number; annualMinor: number }[] {
  const totals = new Map<string, number>();
  const perYear = { daily: 365, weekly: 365 / 7, monthly: 12, yearly: 1 };
  for (const rule of rules) {
    if (
      !rule.active ||
      rule.type !== 'expense' ||
      (rule.endAt !== null && rule.endAt < now) ||
      !Number.isSafeInteger(rule.amountMinor) ||
      rule.amountMinor <= 0 ||
      !Number.isSafeInteger(rule.interval) ||
      rule.interval <= 0
    )
      continue;
    totals.set(
      rule.currency,
      (totals.get(rule.currency) ?? 0) +
        (rule.amountMinor * perYear[rule.frequency]) / rule.interval,
    );
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, annual]) => ({
      currency,
      monthlyMinor: Math.round(annual / 12),
      annualMinor: Math.round(annual),
    }));
}
