import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, radius, spacing, useTheme } from '@/core/ui';
import { applyKeypadKey } from '@/core/utils/calculator';

const ROWS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  [',', '0', '⌫', '+'],
] as const;

type Props = { expression: string; onChange: (expression: string) => void };

export function AmountKeypad({ expression, onChange }: Props) {
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
                onPress={() => onChange(applyKeypadKey(expression, key))}
                onLongPress={key === '⌫' ? () => onChange('') : undefined}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: isOperator ? colors.primarySoft : colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
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
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
