import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { schema, useDb } from '@/core/db';
import { AppText, Button, Card, SectionHeader } from '@/core/ui';
import { formatMinor } from '@/core/utils/money';
import type { SpendingInsight } from '@/features/stats/domain/insights';
import type { TransactionView } from '@/features/transactions';
import { useRecurringRules } from '../data/queries';
import { ignoreSubscription, restoreSubscription } from '../data/subscriptionReviewRepo';
import {
  existingSubscription,
  parseSubscriptionReviews,
  reviewKey,
  SUBSCRIPTION_REVIEWS_KEY,
  type SubscriptionSuggestion,
} from '../domain/subscriptionReview';
import { RecurringFormModal } from './RecurringFormModal';
import { SubscriptionEvidence } from './SubscriptionEvidence';

export function SubscriptionSuggestions({
  insights,
  rows,
}: {
  insights: readonly SpendingInsight[];
  rows: readonly TransactionView[];
}) {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const rules = useRecurringRules();
  const { data: settings } = useLiveQuery(
    db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, SUBSCRIPTION_REVIEWS_KEY)),
  );
  const reviews = settings[0] ? parseSubscriptionReviews(settings[0].value) : [];
  const [reviewing, setReviewing] = useState<SubscriptionSuggestion | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = rules.find((rule) => rule.id === editingId);
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const visible = insights.filter(
    (insight) =>
      insight.kind === 'unusual' ||
      !reviews.some((review) => review.key === reviewKey(insight) && review.ignored),
  );
  const persist = (action: () => void) => {
    try {
      action();
    } catch {
      Alert.alert(t('errors.generic'), t('insights.saveError'));
    }
  };
  return (
    <>
      {visible.length === 0 ? (
        <Card>
          <AppText>{t('insights.empty')}</AppText>
        </Card>
      ) : null}
      {visible.map((insight) => {
        const suggestion = {
          insight,
          evidence: rows.filter((row) => insight.transactionIds.includes(row.id)),
        };
        const existingId = existingSubscription(suggestion, rules, reviews);
        return (
          <Card key={insight.id}>
            <AppText variant="heading">
              {t(`insights.${insight.kind}`, { merchant: insight.merchant })}
            </AppText>
            <AppText>
              {t(`insights.${insight.kind}Reason`, {
                amount: formatMinor(insight.amountMinor, insight.currency, locale),
                baseline: formatMinor(insight.baselineMinor, insight.currency, locale),
              })}
            </AppText>
            <SubscriptionEvidence suggestion={suggestion} />
            {insight.kind !== 'unusual' ? (
              <>
                {existingId !== null ? <AppText>{t('insights.duplicate')}</AppText> : null}
                <Button
                  title={t(existingId !== null ? 'insights.openExisting' : 'insights.review')}
                  onPress={() =>
                    existingId !== null ? setEditingId(existingId) : setReviewing(suggestion)
                  }
                  variant="secondary"
                />
                <Button
                  title={t('insights.ignore')}
                  variant="secondary"
                  onPress={() => persist(() => ignoreSubscription(db, suggestion))}
                />
              </>
            ) : null}
          </Card>
        );
      })}
      {reviews.some((review) => review.ignored) ? (
        <>
          <SectionHeader title={t('insights.ignored')} />
          {reviews
            .filter((review) => review.ignored)
            .map((review) => (
              <Card key={review.key}>
                <AppText>
                  {review.merchant} · {review.currency}
                </AppText>
                <Button
                  title={t('insights.restore')}
                  variant="secondary"
                  onPress={() => persist(() => restoreSubscription(db, review.key))}
                />
              </Card>
            ))}
        </>
      ) : null}
      {reviewing ? (
        <RecurringFormModal suggestion={reviewing} onClose={() => setReviewing(null)} />
      ) : null}
      {editing ? <RecurringFormModal rule={editing} onClose={() => setEditingId(null)} /> : null}
    </>
  );
}
