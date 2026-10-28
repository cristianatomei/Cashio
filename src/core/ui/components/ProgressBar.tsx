import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { radius, useTheme } from '../theme';
import { contrastingColor } from '../theme/contrast';

type Props = {
  /** 0 to 1; values above 1 stay full and turn to the over-budget color. */
  value: number;
  color?: string;
  accessibilityLabel?: string;
};

export function ProgressBar({ value, color, accessibilityLabel }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const safeValue = Number.isFinite(value) ? Math.max(value, 0) : 0;
  const clamped = Math.min(safeValue, 1);
  const fill = value > 1 ? colors.expense : (color ?? colors.primary);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('accessibility.progressLabel')}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clamped * 100),
        text: t('accessibility.progressValue', { value: Math.round(safeValue * 100) }),
      }}
      style={[
        styles.track,
        { backgroundColor: colors.primarySoft, borderColor: colors.controlBorder },
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: contrastingColor(fill, colors.primarySoft),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderWidth: 1, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
