import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, minimumTouchTarget, useTheme } from '@/core/ui';
import { addMonths } from '@/core/utils/dates';

type Props = { monthStart: number; onChange: (monthStart: number) => void };

export function MonthSwitcher({ monthStart, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const label = new Date(monthStart).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.previousMonth')}
        onPress={() => onChange(addMonths(monthStart, -1))}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <AppText variant="heading" style={styles.label}>
        {label}
      </AppText>
      <Pressable
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.nextMonth')}
        onPress={() => onChange(addMonths(monthStart, 1))}
      >
        <Ionicons name="chevron-forward" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { textTransform: 'capitalize', flex: 1, textAlign: 'center' },
  button: {
    minWidth: minimumTouchTarget,
    minHeight: minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
