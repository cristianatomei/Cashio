import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { minimumTouchTarget, radius, spacing, typography, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = TextInputProps & { label?: string };

export function TextField({ label, style, ...rest }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
      ) : null}
      <TextInput
        allowFontScaling
        accessibilityLabel={label ?? rest.placeholder}
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          typography.body,
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.controlBorder,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  input: {
    minHeight: minimumTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
