import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { minimumTouchTarget, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  value?: string;
  placeholder?: string;
  leading?: ReactNode;
  onPress?: () => void;
};

export function FormRow({ label, value, placeholder, leading, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible={!!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        onPress ? [label, value || placeholder].filter(Boolean).join(', ') : undefined
      }
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.primarySoft : 'transparent',
        },
      ]}
    >
      <View
        style={styles.leading}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {leading}
      </View>
      <View style={styles.texts}>
        <AppText variant="caption" color="textMuted">
          {label}
        </AppText>
        <AppText variant="body" color={value ? 'text' : 'textMuted'}>
          {value || placeholder || ''}
        </AppText>
      </View>
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textMuted}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leading: { width: 36, alignItems: 'center' },
  texts: { flex: 1, gap: 2 },
});
