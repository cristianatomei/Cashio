import { ActivityIndicator, Pressable, StyleSheet, type AccessibilityProps } from 'react-native';

import { minimumTouchTarget, radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = Pick<AccessibilityProps, 'accessibilityLabel' | 'accessibilityHint'> & {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { colors } = useTheme();
  const background =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.expense : colors.surface;
  const textColor = variant === 'secondary' ? 'text' : 'onPrimary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: pressed
            ? colors.textSecondary
            : variant === 'secondary'
              ? colors.controlBorder
              : background,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? colors.text : colors.onPrimary}
          accessible={false}
        />
      ) : (
        <AppText variant="heading" color={textColor} style={styles.label}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  label: { textAlign: 'center', flexShrink: 1 },
});
