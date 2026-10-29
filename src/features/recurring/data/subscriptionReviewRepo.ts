import { eq, inArray } from 'drizzle-orm';
import { schema, type AppDb } from '@/core/db';
import {
  existingSubscription,
  parseSubscriptionReviews,
  reviewKey,
  SUBSCRIPTION_REVIEWS_KEY,
  type SubscriptionReview,
  type SubscriptionSuggestion,
} from '../domain/subscriptionReview';
import { saveRecurringRule, type RecurringInput } from './recurringRepo';

export function loadSubscriptionReviews(db: AppDb): SubscriptionReview[] {
  const value = db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SUBSCRIPTION_REVIEWS_KEY))
    .get()?.value;
  return value ? parseSubscriptionReviews(value) : [];
}

function storeReview(db: AppDb, review: SubscriptionReview): void {
  const reviews = loadSubscriptionReviews(db).filter((row) => row.key !== review.key);
  const value = JSON.stringify([...reviews, review]);
  db.insert(schema.appSettings)
    .values({ key: SUBSCRIPTION_REVIEWS_KEY, value })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value } })
    .run();
}

export function ignoreSubscription(db: AppDb, suggestion: SubscriptionSuggestion): void {
  db.transaction((tx) => {
    const key = reviewKey(suggestion.insight);
    storeReview(tx, {
      key,
      merchant: suggestion.insight.merchant,
      currency: suggestion.insight.currency,
      ignored: true,
      ruleId: loadSubscriptionReviews(tx).find((row) => row.key === key)?.ruleId ?? null,
    });
  });
}

export function restoreSubscription(db: AppDb, key: string): void {
  db.transaction((tx) => {
    const reviews = loadSubscriptionReviews(tx).flatMap((row) =>
      row.key !== key ? [row] : row.ruleId === null ? [] : [{ ...row, ignored: false }],
    );
    tx.insert(schema.appSettings)
      .values({ key: SUBSCRIPTION_REVIEWS_KEY, value: JSON.stringify(reviews) })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value: JSON.stringify(reviews) },
      })
      .run();
  });
}

export class SubscriptionReviewError extends Error {
  constructor(public readonly reason: 'duplicate' | 'stale') {
    super(reason);
  }
}

/** The rule and its source identity are saved together; historical payments are never edited. */
export function confirmSubscription(
  db: AppDb,
  suggestion: SubscriptionSuggestion,
  input: RecurringInput,
): number {
  return db.transaction((tx) => {
    const transactions = tx
      .select()
      .from(schema.transactions)
      .where(inArray(schema.transactions.id, suggestion.insight.transactionIds))
      .all();
    if (
      input.id !== undefined ||
      input.type !== 'expense' ||
      !Number.isSafeInteger(input.amountMinor) ||
      input.amountMinor <= 0 ||
      !/^[A-Z]{3}$/.test(input.currency) ||
      !Number.isSafeInteger(input.interval) ||
      input.interval <= 0 ||
      !Number.isSafeInteger(input.nextDue) ||
      suggestion.insight.kind === 'unusual' ||
      transactions.length !== suggestion.insight.transactionIds.length ||
      transactions.some((row) => {
        const evidence = suggestion.evidence.find((item) => item.id === row.id);
        return (
          row.type !== 'expense' ||
          row.status !== 'confirmed' ||
          !evidence ||
          row.amountMinor !== evidence.amountMinor ||
          row.currency !== evidence.currency ||
          row.merchantId !== (evidence.merchant?.id ?? null) ||
          row.occurredAt !== evidence.occurredAt
        );
      })
    )
      throw new SubscriptionReviewError('stale');
    const merchants = tx.select().from(schema.merchants).all();
    const rules = tx
      .select()
      .from(schema.recurringRules)
      .all()
      .map((rule) => ({
        ...rule,
        merchantName: merchants.find((merchant) => merchant.id === rule.merchantId)?.name,
      }));
    const fresh = {
      ...suggestion,
      evidence: suggestion.evidence.map((row) => ({
        ...row,
        recurringId:
          transactions.find((transaction) => transaction.id === row.id)?.recurringId ?? null,
      })),
    };
    const reviews = loadSubscriptionReviews(tx);
    const edited = {
      ...fresh,
      insight: {
        ...suggestion.insight,
        merchant: input.note || suggestion.insight.merchant,
        currency: input.currency,
      },
      evidence: fresh.evidence.map((row) => ({
        ...row,
        merchant:
          input.merchantId === null
            ? null
            : {
                id: input.merchantId,
                name: merchants.find((merchant) => merchant.id === input.merchantId)?.name ?? '',
              },
      })),
    };
    if (
      transactions.some((row) => rules.some((rule) => rule.id === row.recurringId)) ||
      existingSubscription(fresh, rules, reviews) !== null ||
      existingSubscription(edited, rules, reviews) !== null
    )
      throw new SubscriptionReviewError('duplicate');
    const id = saveRecurringRule(tx, input);
    storeReview(tx, {
      key: reviewKey(suggestion.insight),
      merchant: suggestion.insight.merchant,
      currency: suggestion.insight.currency,
      ignored: false,
      ruleId: id,
    });
    return id;
  });
}
