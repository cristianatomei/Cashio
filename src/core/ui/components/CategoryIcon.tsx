import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { radius, useTheme } from '../theme';
import { contrastingColor, tintedSurface } from '../theme/contrast';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type Props = { name: string; color: string; size?: number };

export function CategoryIcon({ name, color, size = 40 }: Props) {
  const { colors } = useTheme();
  // The circle can appear on cards or pages, so check each actual composite.
  const foreground =
    contrastingColor(color, tintedSurface(color, colors.surface)) === color &&
    contrastingColor(color, tintedSurface(color, colors.background)) === color &&
    contrastingColor(color, tintedSurface(color, colors.surfaceElevated)) === color &&
    contrastingColor(color, tintedSurface(color, colors.primarySoft)) === color
      ? color
      : colors.text;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: size, height: size, backgroundColor: `${color}26`, borderRadius: radius.pill },
      ]}
    >
      <MaterialCommunityIcons name={name as IconName} size={size * 0.55} color={foreground} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
