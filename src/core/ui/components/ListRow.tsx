import Ionicons from '@expo/vector-icons/Ionicons';
import { isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityProps } from 'react-native';

import { minimumTouchTarget, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = Pick<
  AccessibilityProps,
  'accessibilityLabel' | 'accessibilityHint' | 'accessibilityRole' | 'accessibilityState'
> & {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
};

export function ListRow({ title, subtitle, leading, trailing, onPress, ...accessibility }: Props) {
  const { colors } = useTheme();
  const decorativeTrailing = isValidElement(trailing) && trailing.type === Ionicons;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible={!!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      {...accessibility}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.primarySoft : 'transparent',
        },
      ]}
    >
      {leading ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {leading}
        </View>
      ) : null}
      <View style={styles.texts}>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <View
          style={styles.trailing}
          accessibilityElementsHidden={decorativeTrailing}
          importantForAccessibility={decorativeTrailing ? 'no-hide-descendants' : 'auto'}
        >
          {trailing}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: minimumTouchTarget,
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  texts: { flex: 1, flexBasis: '40%', minWidth: 0, gap: 2 },
  trailing: { flexShrink: 1, maxWidth: '100%' },
});
