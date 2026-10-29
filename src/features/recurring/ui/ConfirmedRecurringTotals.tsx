import { useTranslation } from 'react-i18next';
import { AppText, Card, SectionHeader } from '@/core/ui';
import { formatMinor } from '@/core/utils/money';
import { useRecurringRules } from '../data/queries';
import { confirmedRecurringTotals } from '../domain/subscriptionReview';

export function ConfirmedRecurringTotals({ now }: { now: number }) {
  const { t, i18n } = useTranslation();
  const rules = useRecurringRules();
  const totals = confirmedRecurringTotals(rules, now);
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  return (
    <>
      <SectionHeader title={t('insights.confirmedTotals')} />
      <Card>
        <AppText variant="caption" color="textSecondary">
          {t('insights.totalsHint')}
        </AppText>
        {totals.length === 0 ? <AppText>{t('insights.noConfirmed')}</AppText> : null}
        {totals.map((total) => (
          <AppText key={total.currency}>
            {t('insights.total', {
              currency: total.currency,
              monthly: formatMinor(total.monthlyMinor, total.currency, locale),
              annual: formatMinor(total.annualMinor, total.currency, locale),
            })}
          </AppText>
        ))}
      </Card>
    </>
  );
}
