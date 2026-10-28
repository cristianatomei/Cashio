import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, ProgressBar, spacing } from '@/core/ui';
import { formatMinor } from '@/core/utils/money';
import type { SavingsGoal } from '../data/repo';
import { goalProgress } from '../domain/goals';

export function GoalSummary({ goal }: { goal: SavingsGoal }) {
  const { t, i18n } = useTranslation();
  const progress = goalProgress(goal);
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="heading">{goal.name}</AppText>
      <AppText>
        {t('planning.goalAmounts', {
          current: formatMinor(goal.currentMinor, goal.currency, locale),
          target: formatMinor(goal.targetMinor, goal.currency, locale),
        })}
      </AppText>
      <ProgressBar value={progress.percent / 100} accessibilityLabel={goal.name} />
      <AppText color="textSecondary">
        {progress.complete
          ? t('planning.complete')
          : t('planning.remaining', {
              amount: formatMinor(progress.remainingMinor, goal.currency, locale),
              percent: progress.percent,
            })}
      </AppText>
    </View>
  );
}
