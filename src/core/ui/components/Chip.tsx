import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  selected?: boolean;
  /** Tints the chip; falls back to the primary color. */
  color?: string;
  leading?: ReactNode;
  onPress?: () => void;
};

export function Chip({ label, selected, color, leading, onPress }: Props) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? tint : colors.border,
          backgroundColor: selected ? `${tint}26` : colors.surface,
        },
      ]}
    >
      {leading}
      <AppText variant="body" color={selected ? 'text' : 'textSecondary'}>
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
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
