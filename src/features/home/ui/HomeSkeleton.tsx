import { StyleSheet, View } from 'react-native';
import { Card, spacing, useTheme } from '@/core/ui';

export function HomeSkeleton({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={styles.stack}
    >
      {[120, 80, 80, 80].map((height, index) => (
        <Card key={index}>
          <View
            importantForAccessibility="no-hide-descendants"
            style={{ height, backgroundColor: colors.border, borderRadius: 8 }}
          />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: spacing.md } });
