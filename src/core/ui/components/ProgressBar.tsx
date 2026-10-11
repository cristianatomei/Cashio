import { StyleSheet, View } from 'react-native';

import { radius, useTheme } from '../theme';

type Props = {
  /** 0 to 1; values above 1 stay full and turn to the over-budget color. */
  value: number;
  color?: string;
};

export function ProgressBar({ value, color }: Props) {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(value, 0), 1);
  const fill = value > 1 ? colors.expense : (color ?? colors.primary);

  return (
    <View style={[styles.track, { backgroundColor: colors.border }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: fill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
