import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card } from '@/core/ui';
import { formatMinor } from '@/core/utils/money';
import { useGoals, useNetWorth } from '../data/queries';
import { GoalSummary } from './GoalSummary';
import { PlanningButton } from './PlanningButton';
import { usePlanningTime } from './usePlanningTime';

export function PlanningCards() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { data: goals, error: goalsError, updatedAt: goalsAt } = useGoals();
  const now = usePlanningTime();
  const worth = useNetWorth(now);
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  return (
    <>
      <Card style={{ gap: 12 }}>
        <AppText variant="heading">{t('planning.goals')}</AppText>
        {goalsError || !goalsAt ? (
          <AppText>{t(goalsError ? 'planning.loadError' : 'planning.loading')}</AppText>
        ) : goals.length ? (
          goals.slice(0, 3).map((goal) => <GoalSummary key={goal.id} goal={goal} />)
        ) : (
          <AppText>{t('planning.emptyGoals')}</AppText>
        )}
        <PlanningButton title={t('planning.openGoals')} onPress={() => router.push('/goals')} />
      </Card>
      <Card style={{ gap: 12 }}>
        <AppText variant="heading">{t('planning.netWorth')}</AppText>
        <AppText variant="heading">
          {worth.loading || worth.error || worth.netMinor === null
            ? t('planning.unavailable')
            : formatMinor(worth.netMinor, worth.baseCurrency, locale)}
        </AppText>
        <AppText color="textSecondary">
          {t(
            worth.loading
              ? 'planning.loading'
              : worth.error
                ? 'planning.loadError'
                : `planning.status.${worth.status}`,
          )}
        </AppText>
        {worth.loans.rows.length ? (
          <AppText color="textSecondary">{t('planning.loanEstimate')}</AppText>
        ) : null}
        <PlanningButton title={t('planning.openWorth')} onPress={() => router.push('/net-worth')} />
      </Card>
    </>
  );
}
