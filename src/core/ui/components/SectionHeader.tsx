import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { AppText } from './AppText';

type Props = { title: string; action?: ReactNode };

export function SectionHeader({ title, action }: Props) {
  return (
    <View style={styles.row}>
      <AppText variant="heading" style={styles.title}>
        {title}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  title: { flex: 1 },
});
