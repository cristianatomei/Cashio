import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
};

export function EmptyState({ icon, title, body }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <AppText variant="heading">{title}</AppText>
      {body ? (
        <AppText color="textSecondary" style={styles.body}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  body: { textAlign: 'center', paddingHorizontal: spacing.xl },
});
