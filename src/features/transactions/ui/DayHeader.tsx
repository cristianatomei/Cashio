import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText, AppText, spacing } from '@/core/ui';

type Props = { dayStart: number; totalMinor: number; currency: string };

export function DayHeader({ dayStart, totalMinor, currency }: Props) {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const label = new Date(dayStart).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={styles.row}>
      <AppText variant="caption" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <AmountText amountMinor={totalMinor} currency={currency} variant="caption" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  label: { flex: 1, textTransform: 'capitalize' },
});
