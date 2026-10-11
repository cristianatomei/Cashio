import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '../theme';
import { CategoryIcon } from './CategoryIcon';

type Props = {
  icons: readonly string[];
  value: string;
  color: string;
  onChange: (icon: string) => void;
};

export function IconGrid({ icons, value, color, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {icons.map((icon) => {
        const selected = icon === value;
        return (
          <Pressable
            key={icon}
            onPress={() => onChange(icon)}
            style={[styles.cell, selected && { borderColor: color, borderWidth: 2 }]}
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
    padding: 2,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
