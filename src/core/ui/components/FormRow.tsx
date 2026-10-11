import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '../theme';
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
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={styles.leading}>{leading}</View>
      <View style={styles.texts}>
        <AppText variant="caption" color="textMuted">
          {label}
        </AppText>
        <AppText variant="body" color={value ? 'text' : 'textMuted'}>
          {value || placeholder || ''}
        </AppText>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leading: { width: 36, alignItems: 'center' },
  texts: { flex: 1, gap: 2 },
});
