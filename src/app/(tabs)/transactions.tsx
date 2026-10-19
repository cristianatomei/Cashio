import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DEFAULT_CURRENCY } from '@/core/db';
import type { TransactionType } from '@/core/domain/transaction';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FormRow,
  Screen,
  SheetModal,
  TextField,
  spacing,
} from '@/core/ui';
import { useCaptureRefresh } from '@/features/capture';
import { IngCsvImportCard } from '@/features/backup';
import { AccountPickerModal, useAccounts } from '@/features/accounts';
import { CategoryPickerModal, useTaxonomy } from '@/features/categories';
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
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [picker, setPicker] = useState<'category' | 'account' | null>(null);

  const range = useMemo(() => monthRange(monthStart), [monthStart]);
  const views = useTransactionViews(range);
  const totals = useMemo(() => summarize(views), [views]);
  const accounts = useAccounts();
  const taxonomy = useTaxonomy();
  const selectedCategory = taxonomy
    .flatMap((group) => group.categories)
    .find((category) => category.id === categoryId);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const activeFilterCount = Number(categoryId !== null) + Number(accountId !== null);
  const groups = useMemo(
    () => groupByDay(filterTransactions(views, { query, type, categoryId, accountId })),
    [views, query, type, categoryId, accountId],
  );

  return (
    <Screen title={t('transactions.title')} onRefresh={refresh}>
      <MonthSwitcher monthStart={monthStart} onChange={setMonthStart} />
      <SummaryCard totals={totals} currency={DEFAULT_CURRENCY} />
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={t('transactions.searchPlaceholder')}
      />
      <View style={styles.chips}>
        <Chip
          label={t('transactions.filterAll')}
          selected={type === 'all'}
          onPress={() => setType('all')}
        />
        {(['expense', 'income', 'transfer'] as const).map((value) => (
          <Chip
            key={value}
            label={t(`types.${value}`)}
            selected={type === value}
            onPress={() => setType(value)}
          />
        ))}
        <Chip
          label={
            activeFilterCount > 0
              ? t('transactions.filtersCount', { count: activeFilterCount })
              : t('transactions.filters')
          }
          selected={activeFilterCount > 0}
          onPress={() => setFiltersOpen(true)}
        />
      </View>
      {type === 'expense' ? <IngCsvImportCard /> : null}

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
      {filtersOpen ? (
        <SheetModal
          visible
          title={t('transactions.filterTitle')}
          onClose={() => setFiltersOpen(false)}
        >
          <FormRow
            label={t('transactions.filterCategory')}
            value={selectedCategory?.name}
            placeholder={t('transactions.allCategories')}
            onPress={() => setPicker('category')}
          />
          <FormRow
            label={t('transactions.filterAccount')}
            value={selectedAccount?.name}
            placeholder={t('transactions.allAccounts')}
            onPress={() => setPicker('account')}
          />
          {activeFilterCount > 0 ? (
            <Button
              title={t('transactions.clearFilters')}
              variant="secondary"
              onPress={() => {
                setCategoryId(null);
                setAccountId(null);
              }}
            />
          ) : null}
        </SheetModal>
      ) : null}
      {picker === 'category' ? (
        <CategoryPickerModal
          selectedId={categoryId}
          onSelect={setCategoryId}
          onClear={() => setCategoryId(null)}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'account' ? (
        <AccountPickerModal
          selectedId={accountId}
          onSelect={setAccountId}
          onClear={() => setAccountId(null)}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayCard: { marginTop: spacing.sm, paddingVertical: 0 },
});
