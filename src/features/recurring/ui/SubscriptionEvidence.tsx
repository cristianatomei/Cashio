import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui';
import { formatMinor } from '@/core/utils/money';
import type { SubscriptionSuggestion } from '../domain/subscriptionReview';

export function SubscriptionEvidence({
  suggestion,
  onNavigate,
}: {
  suggestion: SubscriptionSuggestion;
  onNavigate?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  return suggestion.evidence.map((row) => (
    <Button
      key={row.id}
      variant="secondary"
      title={t('insights.openEvidence', {
        id: row.id,
        date: new Date(row.occurredAt).toLocaleDateString(locale),
        amount: formatMinor(row.amountMinor, row.currency, locale),
      })}
      onPress={() => {
        onNavigate?.();
        router.push({ pathname: '/add-transaction', params: { id: String(row.id) } });
      }}
    />
  ));
}
