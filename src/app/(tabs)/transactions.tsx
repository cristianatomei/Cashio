import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { schema, useDb } from '@/core/db';
import {
  AppText,
  Button,
  Chip,
  EmptyState,
  FormRow,
  SheetModal,
  TextField,
  spacing,
} from '@/core/ui';
import { monthRange, startOfMonth } from '@/core/utils/dates';
import { useCaptureRefresh } from '@/features/capture';
import { IngCsvImportCard } from '@/features/backup';
import { AccountPickerModal, useAccounts } from '@/features/accounts';
import { CategoryPickerModal, useTaxonomy } from '@/features/categories';
import { useTags } from '@/features/tags';
import {
  MonthSwitcher,
  SummaryCard,
  filterTransactions,
  groupByDay,
  useTransactionViews,
  dailyCurrencyTotals,
  BatchToolbar,
  WorkflowList,
  SelectableTransactionRow,
  useBatchWorkflow,
  calendarDate,
  filterDateRange,
  parseSavedFilter,
  saveFilter,
  type SavedFilter,
} from '@/features/transactions';

const EMPTY: SavedFilter = {
  query: '',
  type: 'all',
  categoryId: null,
  accountId: null,
  tagId: null,
};

export default function TransactionsScreen() {
  const params = useLocalSearchParams<{
    categoryId?: string;
    groupId?: string;
    currency?: string;
    from?: string;
    to?: string;
    type?: string;
  }>();
  const id = (value: string | undefined) =>
    value === 'uncategorized' ? value : value ? Number(value) : null;
  let initialFilter = EMPTY;
  let initialError = false;
  try {
    initialFilter = parseSavedFilter(
      JSON.stringify({
        ...EMPTY,
        categoryId: id(params.categoryId),
        groupId: id(params.groupId),
        currency: params.currency || undefined,
        from: params.from || undefined,
        to: params.to || undefined,
        type: params.type || 'all',
      }),
    );
  } catch {
    initialError = true;
  }
  return (
    <TransactionWorkspace
      key={JSON.stringify(params)}
      initialFilter={initialFilter}
      initialError={initialError}
    />
  );
}

function TransactionWorkspace({
  initialFilter,
  initialError,
}: {
  initialFilter: SavedFilter;
  initialError: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const db = useDb();
  const refresh = useCaptureRefresh();
  const [monthStart, setMonthStart] = useState(() => startOfMonth(Date.now()));
  const [filter, setFilter] = useState<SavedFilter>(initialFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [picker, setPicker] = useState<'category' | 'account' | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = useMemo(
    () => filterDateRange(filter) ?? monthRange(monthStart),
    [filter, monthStart],
  );
  const views = useTransactionViews(range);
  const visible = useMemo(() => filterTransactions(views, filter), [views, filter]);
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const workflow = useBatchWorkflow(visible.map((row) => row.id));
  const accounts = useAccounts();
  const taxonomy = useTaxonomy();
  const tags = useTags();
  const { data: saved } = useLiveQuery(db.select().from(schema.savedTransactionFilters));
  const patch = (value: Partial<SavedFilter>) =>
    setFilter((previous) => ({ ...previous, ...value }));
  const activeCount =
    Number(filter.categoryId != null) +
    Number(filter.groupId != null) +
    Number(!!filter.currency) +
    Number(filter.accountId != null) +
    Number(filter.tagId != null) +
    Number(!!filter.from);
  const fail = (error: unknown) => {
    console.error('Saved filter action failed', error);
    Alert.alert(t('errors.generic'), t('workflows.filterError'));
  };

  return (
    <>
      <WorkflowList
        title={t('transactions.title')}
        groups={groups}
        onRefresh={refresh}
        empty={
          <EmptyState
            icon="receipt-outline"
            title={t('transactions.emptyTitle')}
            body={t('transactions.emptyBody')}
          />
        }
        header={
          <>
            {initialError ? <AppText>{t('workflows.filterError')}</AppText> : null}
            <MonthSwitcher
              monthStart={monthStart}
              onChange={(value) => {
                setMonthStart(value);
                patch({ from: undefined, to: undefined });
              }}
            />
            {dailyCurrencyTotals(views).map((total) => (
              <SummaryCard key={total.currency} totals={total} currency={total.currency} />
            ))}
            {filter.from ? (
              <AppText>
                {filter.from} – {filter.to}
              </AppText>
            ) : null}
            <TextField
              value={filter.query}
              onChangeText={(query) => patch({ query })}
              placeholder={t('transactions.searchPlaceholder')}
            />
            <View style={styles.chips}>
              <Chip
                label={t('transactions.filterAll')}
                selected={filter.type === 'all'}
                onPress={() => patch({ type: 'all' })}
              />
              {(['expense', 'income', 'transfer'] as const).map((type) => (
                <Chip
                  key={type}
                  label={t(`types.${type}`)}
                  selected={filter.type === type}
                  onPress={() => patch({ type })}
                />
              ))}
              <Chip
                label={
                  activeCount
                    ? t('transactions.filtersCount', { count: activeCount })
                    : t('transactions.filters')
                }
                selected={activeCount > 0}
                onPress={() => {
                  setFrom(filter.from ?? '');
                  setTo(filter.to ?? '');
                  setFiltersOpen(true);
                }}
              />
              <Chip
                label={t('workflows.saveView')}
                onPress={() => {
                  setName('');
                  setSaveOpen(true);
                }}
              />
              <Chip
                label={t('workflows.select')}
                selected={workflow.selecting}
                onPress={() =>
                  workflow.selecting ? workflow.clear() : workflow.setSelecting(true)
                }
              />
            </View>
            {saved.length ? <AppText variant="caption">{t('workflows.savedViews')}</AppText> : null}
            {saved.map((item) => (
              <View key={item.id} style={styles.savedRow}>
                <View style={styles.flex}>
                  <Button
                    variant="secondary"
                    title={item.name}
                    onPress={() => {
                      try {
                        setFilter(parseSavedFilter(item.filterJson));
                        workflow.clear();
                      } catch (error) {
                        fail(error);
                      }
                    }}
                  />
                </View>
                <Button
                  variant="secondary"
                  title={t('common.delete')}
                  onPress={() => {
                    try {
                      db.delete(schema.savedTransactionFilters)
                        .where(eq(schema.savedTransactionFilters.id, item.id))
                        .run();
                    } catch (error) {
                      fail(error);
                    }
                  }}
                />
              </View>
            ))}
            {workflow.selecting ? (
              <BatchToolbar
                count={workflow.ids.length}
                disabled={!!workflow.undo}
                onApply={workflow.apply}
                onSelectAll={workflow.selectAll}
                onClear={workflow.clear}
              />
            ) : null}
            {filter.type === 'expense' ? <IngCsvImportCard /> : null}
          </>
        }
        renderRow={(view) => (
          <SelectableTransactionRow
            view={view}
            selecting={workflow.selecting}
            selected={workflow.ids.includes(view.id)}
            onToggle={() => workflow.toggle(view.id)}
            onPress={() =>
              router.push({ pathname: '/add-transaction', params: { id: String(view.id) } })
            }
          />
        )}
      >
        {workflow.snackbar}
      </WorkflowList>
      {filtersOpen ? (
        <SheetModal
          visible
          title={t('transactions.filterTitle')}
          onClose={() => setFiltersOpen(false)}
        >
          <FormRow
            label={t('transactions.filterCategory')}
            value={
              taxonomy
                .flatMap((group) => group.categories)
                .find((category) => category.id === filter.categoryId)?.name
            }
            placeholder={t('transactions.allCategories')}
            onPress={() => setPicker('category')}
          />
          <FormRow
            label={t('transactions.filterAccount')}
            value={accounts.find((account) => account.id === filter.accountId)?.name}
            placeholder={t('transactions.allAccounts')}
            onPress={() => setPicker('account')}
          />
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={`#${tag.name}`}
              selected={filter.tagId === tag.id}
              onPress={() => patch({ tagId: filter.tagId === tag.id ? null : tag.id })}
            />
          ))}
          <TextField
            label={t('workflows.from')}
            value={from}
            onChangeText={setFrom}
            placeholder="YYYY-MM-DD"
          />
          <TextField
            label={t('workflows.to')}
            value={to}
            onChangeText={setTo}
            placeholder="YYYY-MM-DD"
          />
          <Button
            title={t('workflows.applyDates')}
            onPress={() => {
              try {
                const next = parseSavedFilter(
                  JSON.stringify({ ...filter, from: from || undefined, to: to || undefined }),
                );
                setFilter(next);
                setFiltersOpen(false);
              } catch (error) {
                fail(error);
              }
            }}
          />
          <Button
            title={t('transactions.clearFilters')}
            variant="secondary"
            onPress={() => {
              setFilter(EMPTY);
              setFrom('');
              setTo('');
            }}
          />
        </SheetModal>
      ) : null}
      {picker === 'category' ? (
        <CategoryPickerModal
          selectedId={typeof filter.categoryId === 'number' ? filter.categoryId : null}
          onSelect={(categoryId) => patch({ categoryId })}
          onClear={() => patch({ categoryId: null })}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'account' ? (
        <AccountPickerModal
          selectedId={filter.accountId ?? null}
          onSelect={(accountId) => patch({ accountId })}
          onClear={() => patch({ accountId: null })}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {saveOpen ? (
        <SheetModal visible title={t('workflows.saveView')} onClose={() => setSaveOpen(false)}>
          <TextField label={t('common.name')} value={name} onChangeText={setName} />
          <Button
            title={t('common.save')}
            onPress={() => {
              try {
                saveFilter(db, name, {
                  ...filter,
                  from: calendarDate(range.from),
                  to: calendarDate(range.to - 1),
                });
                setSaveOpen(false);
              } catch (error) {
                fail(error);
              }
            }}
          />
        </SheetModal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
