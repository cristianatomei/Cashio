import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { minimumTouchTarget, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  accessibilityLabel?: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/** One focus/activation target; the native switch remains a visual indicator. */
export function SwitchRow({
  label,
  accessibilityLabel,
  description,
  value,
  onValueChange,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={styles.row}
    >
      <View
        style={styles.texts}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <AppText>{label}</AppText>
        {description ? (
          <AppText variant="caption" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Switch
          accessible={false}
          value={value}
          disabled={disabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={value ? colors.onPrimary : colors.textSecondary}
          ios_backgroundColor={colors.border}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  texts: { flex: 1, gap: spacing.xs },
});
