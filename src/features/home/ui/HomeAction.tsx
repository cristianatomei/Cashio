import { Pressable, StyleSheet } from 'react-native';
import { AppText, spacing, useTheme } from '@/core/ui';

export function HomeAction({
  title,
  hint,
  onPress,
}: {
  title: string;
  hint?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { opacity: pressed ? 0.6 : 1, borderColor: colors.border },
      ]}
    >
      <AppText variant="heading">{title}</AppText>
      {hint ? <AppText color="textSecondary">{hint}</AppText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
