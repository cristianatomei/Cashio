import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { radius } from '../theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type Props = { name: string; color: string; size?: number };

// The soft tinted circle keeps any category color readable in light and dark themes.
export function CategoryIcon({ name, color, size = 40 }: Props) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, backgroundColor: `${color}26`, borderRadius: radius.pill },
      ]}
    >
      <MaterialCommunityIcons name={name as IconName} size={size * 0.55} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
