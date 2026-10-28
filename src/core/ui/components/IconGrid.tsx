import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { minimumTouchTarget, spacing, useTheme } from '../theme';
import { CategoryIcon } from './CategoryIcon';

type Props = {
  icons: readonly string[];
  value: string;
  color: string;
  onChange: (icon: string) => void;
  getAccessibilityLabel?: (icon: string) => string;
};

export function IconGrid({ icons, value, color, onChange, getAccessibilityLabel }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {icons.map((icon) => {
        const selected = icon === value;
        return (
          <Pressable
            key={icon}
            onPress={() => onChange(icon)}
            accessibilityRole="radio"
            accessibilityLabel={
              getAccessibilityLabel?.(icon) ??
              t('accessibility.iconOption', {
                name: t(`accessibility.icons.${icon}`, {
                  defaultValue: icon.replace(/-outline$|-/g, ' ').trim(),
                }),
              })
            }
            accessibilityState={{ checked: selected }}
            style={[styles.cell, selected && { borderColor: colors.text, borderWidth: 2 }]}
          >
            <CategoryIcon name={icon} color={selected ? color : colors.textMuted} size={44} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    minWidth: minimumTouchTarget,
    minHeight: minimumTouchTarget,
    padding: 2,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
