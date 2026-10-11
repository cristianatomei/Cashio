import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, swatchColors, useTheme } from '../theme';

type Props = { value: string; onChange: (color: string) => void };

export function ColorSwatches({ value, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {swatchColors.map((color) => (
        <Pressable
          key={color}
          onPress={() => onChange(color)}
          style={[styles.swatch, { backgroundColor: color }]}
        >
          {color.toLowerCase() === value.toLowerCase() ? (
            <Ionicons name="checkmark" size={20} color={colors.onPrimary} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
