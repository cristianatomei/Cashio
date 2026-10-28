import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { minimumTouchTarget, radius, spacing, swatchColors, useTheme } from '../theme';
import { contrastingColor } from '../theme/contrast';

type Props = { value: string; onChange: (color: string) => void };

export function ColorSwatches({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {swatchColors.map((color) => (
        <Pressable
          key={color}
          onPress={() => onChange(color)}
          accessibilityRole="radio"
          accessibilityLabel={t('accessibility.colorOption', {
            name: t(`accessibility.colors.${color.slice(1)}`, { defaultValue: color }),
          })}
          accessibilityState={{ checked: color.toLowerCase() === value.toLowerCase() }}
          style={[
            styles.swatch,
            {
              backgroundColor: color,
              borderColor: colors.text,
            },
          ]}
        >
          {color.toLowerCase() === value.toLowerCase() ? (
            <Ionicons
              name="checkmark"
              size={24}
              color={contrastingColor('#FFFFFF', color, 4.5)}
              accessible={false}
            />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: {
    width: minimumTouchTarget,
    height: minimumTouchTarget,
    borderWidth: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
