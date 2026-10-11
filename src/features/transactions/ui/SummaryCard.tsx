import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText, AppText, Card, spacing } from '@/core/ui';

import type { Totals } from '../domain/grouping';

type Props = { totals: Totals; currency: string };

export function SummaryCard({ totals, currency }: Props) {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <View style={styles.cell}>
        <AppText variant="caption" color="textSecondary">
          {t('summary.income')}
        </AppText>
        <AmountText amountMinor={totals.income} currency={currency} type="income" />
      </View>
      <View style={styles.cell}>
        <AppText variant="caption" color="textSecondary">
          {t('summary.expenses')}
        </AppText>
        <AmountText amountMinor={totals.expense} currency={currency} type="expense" />
      </View>
      <View style={styles.cell}>
        <AppText variant="caption" color="textSecondary">
          {t('summary.balance')}
        </AppText>
        <AmountText amountMinor={totals.balance} currency={currency} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md },
  cell: { flex: 1, gap: spacing.xs },
});
