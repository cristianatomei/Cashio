import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';
import { Alert, SectionList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, spacing, useTheme } from '@/core/ui';

import type { TransactionView } from '../domain/views';
import { dailyCurrencyTotals } from '../domain/merchantIdentity';
import type { DayGroup } from '../domain/grouping';
import { DayHeader } from './DayHeader';

type Props = {
  title: string;
  groups: DayGroup<TransactionView>[];
  header: ReactElement;
  empty?: ReactElement;
  children?: ReactNode;
  renderRow: (view: TransactionView) => ReactElement;
  onRefresh: () => void | Promise<void>;
  topInset?: boolean;
};

/** Owns the sole scroll container so transaction rows stay virtualized. */
export function WorkflowList({
  title,
  groups,
  header,
  empty,
  children,
  renderRow,
  onRefresh,
  topInset = true,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: topInset ? insets.top : 0 },
      ]}
    >
      <SectionList
        style={styles.root}
        sections={groups.map((group) => ({ ...group, data: group.items }))}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="title">{title}</AppText>
            {header}
          </View>
        }
        ListEmptyComponent={empty}
        renderSectionHeader={({ section }) => (
          <View style={{ backgroundColor: colors.background }}>
            {dailyCurrencyTotals(section.items).map((total) => (
              <DayHeader
                key={total.currency}
                dayStart={section.dayStart}
                totalMinor={total.balance}
                currency={total.currency}
              />
            ))}
          </View>
        )}
        renderItem={({ item }) => renderRow(item)}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void Promise.resolve()
            .then(onRefresh)
            .catch((error: unknown) => {
              console.error('Transaction refresh failed', error);
              Alert.alert(t('errors.generic'), t('common.refreshError'));
            })
            .finally(() => setRefreshing(false));
        }}
      />
      {children ? <View style={{ paddingBottom: insets.bottom }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  header: { gap: spacing.md, paddingTop: spacing.md },
});
