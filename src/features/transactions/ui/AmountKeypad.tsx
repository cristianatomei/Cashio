import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, radius, spacing, useTheme } from '@/core/ui';
import { applyKeypadKey } from '@/core/utils/calculator';

const ROWS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  [',', '0', '⌫', '+'],
] as const;

const KEY_LABELS = {
  '÷': 'accessibility.keypad.divide',
  '×': 'accessibility.keypad.multiply',
  '-': 'accessibility.keypad.subtract',
  '+': 'accessibility.keypad.add',
  ',': 'accessibility.keypad.decimal',
  '⌫': 'accessibility.keypad.backspace',
} as const;

type Props = { expression: string; onChange: (expression: string) => void };

export function AmountKeypad({ expression, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.pad}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={styles.row}>
          {row.map((key) => {
            const isOperator = '÷×-+'.includes(key);
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={
                  key in KEY_LABELS ? t(KEY_LABELS[key as keyof typeof KEY_LABELS]) : key
                }
                accessibilityHint={key === '⌫' ? t('accessibility.keypad.clearHint') : undefined}
                accessibilityActions={
                  key === '⌫'
                    ? [{ name: 'clear', label: t('accessibility.keypad.clear') }]
                    : undefined
                }
                onAccessibilityAction={
                  key === '⌫'
                    ? (event) => {
                        if (event.nativeEvent.actionName === 'clear') onChange('');
                      }
                    : undefined
                }
                onPress={() => onChange(applyKeypadKey(expression, key))}
                onLongPress={key === '⌫' ? () => onChange('') : undefined}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: isOperator || pressed ? colors.primarySoft : colors.surface,
                    borderColor: pressed ? colors.text : colors.controlBorder,
                  },
                ]}
              >
                <AppText variant="title" color={isOperator ? 'primary' : 'text'}>
                  {key}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  key: {
    flex: 1,
    minHeight: 52,
    minWidth: 48,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
