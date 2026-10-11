import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DEFAULT_CURRENCY } from '@/core/db';
import type { TransactionType } from '@/core/domain/transaction';
import { Card, Chip, EmptyState, Screen, TextField, spacing } from '@/core/ui';
import { useCaptureRefresh } from '@/features/capture';
import { monthRange, startOfMonth } from '@/core/utils/dates';
import {
  DayHeader,
  MonthSwitcher,
  SummaryCard,
  TransactionRow,
  filterTransactions,
  groupByDay,
  summarize,
  useTransactionViews,
} from '@/features/transactions';

export default function TransactionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const refresh = useCaptureRefresh();
  const [monthStart, setMonthStart] = useState(() => startOfMonth(Date.now()));
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | TransactionType>('all');

  const range = useMemo(() => monthRange(monthStart), [monthStart]);
  const views = useTransactionViews(range);
  const totals = useMemo(() => summarize(views), [views]);
  const groups = useMemo(
    () => groupByDay(filterTransactions(views, { query, type })),
    [views, query, type],
  );

  return (
    <Screen
      title={t('transactions.title')}
      onRefresh={refresh}
    >
      <MonthSwitcher monthStart={monthStart} onChange={setMonthStart} />
      <SummaryCard totals={totals} currency={DEFAULT_CURRENCY} />
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={t('transactions.searchPlaceholder')}
      />
      <View style={styles.chips}>
        <Chip label={t('transactions.filterAll')} selected={type === 'all'} onPress={() => setType('all')} />
        {(['expense', 'income', 'transfer'] as const).map((value) => (
          <Chip
            key={value}
            label={t(`types.${value}`)}
            selected={type === value}
            onPress={() => setType(value)}
          />
        ))}
      </View>

      {groups.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title={t('transactions.emptyTitle')}
          body={t('transactions.emptyBody')}
        />
      ) : (
        groups.map((group) => (
          <View key={group.dayStart}>
            <DayHeader
              dayStart={group.dayStart}
              totalMinor={summarize(group.items).balance}
              currency={DEFAULT_CURRENCY}
            />
            <Card style={styles.dayCard}>
              {group.items.map((view) => (
                <TransactionRow
                  key={view.id}
                  view={view}
                  onPress={() =>
                    router.push({ pathname: '/add-transaction', params: { id: String(view.id) } })
                  }
                />
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayCard: { marginTop: spacing.sm, paddingVertical: 0 },
});
