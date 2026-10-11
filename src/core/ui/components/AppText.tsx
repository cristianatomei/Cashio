import { Text, type TextProps } from 'react-native';

import { typography, useTheme, type TextVariant, type ThemeColors } from '../theme';

type TextColor = keyof Pick<
  ThemeColors,
  'text' | 'textSecondary' | 'textMuted' | 'primary' | 'income' | 'expense' | 'warning' | 'onPrimary'
>;

type Props = TextProps & { variant?: TextVariant; color?: TextColor };

export function AppText({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const { colors } = useTheme();
  return <Text {...rest} style={[typography[variant], { color: colors[color] }, style]} />;
}
