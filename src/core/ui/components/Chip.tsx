import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityProps } from 'react-native';

import { minimumTouchTarget, radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = Pick<AccessibilityProps, 'accessibilityLabel' | 'accessibilityHint'> & {
  label: string;
  selected?: boolean;
  /** Tints the chip; falls back to the primary color. */
  color?: string;
  leading?: ReactNode;
  onPress?: () => void;
};

export function Chip({
  label,
  selected,
  color,
  leading,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible={!!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={onPress && selected !== undefined ? { selected } : undefined}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.textSecondary : colors.controlBorder,
          backgroundColor: selected ? `${tint}26` : colors.surface,
        },
      ]}
    >
      {leading ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {leading}
        </View>
      ) : null}
      <AppText variant="body" color={selected ? 'text' : 'textSecondary'} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { flexShrink: 1 },
});
