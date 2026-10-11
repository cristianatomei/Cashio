import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { eq } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { schema, useDb } from '@/core/db';
import type { TransactionType } from '@/core/domain/transaction';
import {
  AmountText,
  AppText,
  Button,
  Card,
  CategoryIcon,
  FormRow,
  SegmentedControl,
  TextField,
  confirmDestructive,
  radius,
  spacing,
  useTheme,
} from '@/core/ui';
import { combineDateAndTime } from '@/core/utils/dates';
import { evaluateExpression } from '@/core/utils/calculator';
import { minorToInput, parseAmountToMinor } from '@/core/utils/money';
import { notifyBudgetThresholds } from '@/features/budgets';
import { AccountPickerModal, useAccounts } from '@/features/accounts';
import { CategoryPickerModal, useTaxonomy } from '@/features/categories';
import { MerchantPickerModal, useMerchants } from '@/features/merchants';
import { syncRecurringReminder } from '@/features/recurring';
import { TagPickerModal, useTags } from '@/features/tags';

import { deleteTransaction, loadTransaction, saveTransaction } from '../data/transactionsRepo';
import { validateTransaction } from '../domain/validation';
import { AmountKeypad } from './AmountKeypad';

type Picker =
  | 'category'
  | 'account'
  | 'transferAccount'
  | 'merchant'
  | 'tags'
  | { allocationIndex: number }
  | null;
type AllocationDraft = { categoryId: number | null; amount: string };

type Props = { transactionId?: number };

export function TransactionForm({ transactionId }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useDb();
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';

  const initial = useMemo(
    () => (transactionId === undefined ? null : loadTransaction(db, transactionId)),
    [db, transactionId],
  );

  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [expression, setExpression] = useState(initial ? minorToInput(initial.amountMinor) : '');
  const [accountId, setAccountId] = useState<number | null>(initial?.accountId ?? null);
  const [unassignedCurrency, setUnassignedCurrency] = useState(initial?.currency ?? 'RON');
  const [transferAccountId, setTransferAccountId] = useState<number | null>(
    initial?.transferAccountId ?? null,
  );
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [merchantId, setMerchantId] = useState<number | null>(initial?.merchantId ?? null);
  const [tagIds, setTagIds] = useState<number[]>(initial?.tagIds ?? []);
  const [allocations, setAllocations] = useState<AllocationDraft[]>(
    () =>
      initial?.allocations?.map((item) => ({
        categoryId: item.categoryId,
        amount: minorToInput(item.amountMinor),
      })) ?? [],
  );
  const [splitting, setSplitting] = useState((initial?.allocations?.length ?? 0) > 1);
  const [note, setNote] = useState(initial?.note ?? '');
  const [occurredAt, setOccurredAt] = useState(() => initial?.occurredAt ?? Date.now());
  const [picker, setPicker] = useState<Picker>(null);
  const [noteFocused, setNoteFocused] = useState(false);

  const accounts = useAccounts({ includeArchived: true });
  const merchants = useMerchants();
  const tags = useTags();
  const groups = useTaxonomy({
    kind: type === 'income' ? 'income' : 'expense',
    includeArchived: true,
  });

  const effectiveAccountId = accountId;
  const account = accounts.find((a) => a.id === accountId);
  const transferAccount = accounts.find((a) => a.id === transferAccountId);
  const category = groups.flatMap((g) => g.categories).find((c) => c.id === categoryId);
  const categoryGroup = groups.find((g) => g.id === category?.groupId);
  const merchant = merchants.find((m) => m.id === merchantId);
  const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));
  const amountMinor = evaluateExpression(expression);
  const currency = account?.currency ?? unassignedCurrency;
  const splitAllocations = allocations.map((allocation) => ({
    categoryId: allocation.categoryId,
    amountMinor: parseAmountToMinor(allocation.amount),
  }));
  const splitTotal = splitAllocations.every((allocation) => allocation.amountMinor !== null)
    ? splitAllocations.reduce((total, allocation) => total + (allocation.amountMinor ?? 0), 0)
    : null;
  const splitIsValid =
    splitAllocations.length >= 2 &&
    splitAllocations.every(
      (allocation) => allocation.categoryId !== null && allocation.amountMinor !== null && allocation.amountMinor > 0,
    ) &&
    splitTotal === amountMinor;
  const effectiveCategoryId = splitting ? (allocations[0]?.categoryId ?? null) : categoryId;
  const isTransfer = type === 'transfer';
  const allocationCategory = (id: number | null) =>
    id === null ? undefined : groups.flatMap((group) => group.categories).find((item) => item.id === id);

  const toggleSplit = () => {
    if (splitting) {
      setCategoryId(allocations[0]?.categoryId ?? categoryId);
      setSplitting(false);
      return;
    }
    setAllocations([
      { categoryId, amount: minorToInput(amountMinor ?? 0) },
      { categoryId: null, amount: '0.00' },
    ]);
    setSplitting(true);
  };

  const changeType = (next: TransactionType) => {
    if (next !== type) {
      if (next === 'income' || type === 'income') setCategoryId(null);
      setSplitting(false);
      setAllocations([]);
    }
    setType(next);
  };

  const openDialog = (mode: 'date' | 'time') => {
    if (Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({
      value: new Date(occurredAt),
      mode,
      is24Hour: true,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        setOccurredAt(
          mode === 'date'
            ? combineDateAndTime(date.getTime(), occurredAt)
            : combineDateAndTime(occurredAt, date.getTime()),
        );
      },
    });
  };

  const save = () => {
    const error = validateTransaction({
      type,
      accountId: effectiveAccountId,
      transferAccountId,
      amountMinor,
      categoryId: effectiveCategoryId,
      allocations: splitting ? splitAllocations : undefined,
    });
    if (error) {
      Alert.alert(t(`form.errors.${error}`));
      return;
    }
    if (amountMinor === null || (isTransfer && effectiveAccountId === null)) return;
    if (!/^[A-Z]{3}$/.test(currency)) {
      Alert.alert(t('form.errors.currency'));
      return;
    }
    if (splitting && !splitIsValid) {
      Alert.alert(t('form.errors.splitAmounts'));
      return;
    }

    const savedId = saveTransaction(db, {
      id: transactionId,
      type,
      accountId: effectiveAccountId,
      transferAccountId,
      amountMinor,
      currency,
      categoryId: effectiveCategoryId,
      merchantId,
      note,
      tagIds,
      allocations: splitting
        ? splitAllocations.map((allocation) => ({
            categoryId: allocation.categoryId,
            amountMinor: allocation.amountMinor ?? 0,
          }))
        : undefined,
      occurredAt,
    });
    void notifyBudgetThresholds(db, savedId, (name, threshold) => ({
      title: t('budgets.thresholdTitle'),
      body:
        threshold === 80
          ? t('budgets.threshold80', { name })
          : t('budgets.threshold100', { name }),
    })).catch((error: unknown) => {
      console.error('Failed to send budget threshold alert', error);
      Alert.alert(t('errors.generic'), t('budgets.notificationError'));
    });
    const recurringId = db
      .select({ recurringId: schema.transactions.recurringId })
      .from(schema.transactions)
      .where(eq(schema.transactions.id, savedId))
      .get()?.recurringId;
    if (recurringId !== null && recurringId !== undefined) {
      void syncRecurringReminder(db, recurringId, {
        title: t('recurring.reminderTitle'),
        body: (name) => t('recurring.reminderBody', { name }),
      }).catch((error: unknown) => {
        console.error('Failed to update recurring reminder after payment', error);
        Alert.alert(t('errors.generic'), t('recurring.reminderError'));
      });
    }
    router.back();
  };

  const remove = () => {
    if (transactionId === undefined) return;
    confirmDestructive({
      title: t('form.deleteTitle'),
      message: t('form.deleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        deleteTransaction(db, transactionId);
        router.back();
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SegmentedControl
          value={type}
          onChange={changeType}
          options={[
            { value: 'expense', label: t('types.expense') },
            { value: 'income', label: t('types.income') },
            { value: 'transfer', label: t('types.transfer') },
          ]}
        />

        <Card style={styles.amountCard}>
          <AppText variant="caption" color="textSecondary">
            {t('form.amount')}
          </AppText>
          <AppText variant="display" color={expression ? 'text' : 'textMuted'}>
            {expression || '0'}
          </AppText>
          {amountMinor !== null && /[÷×+-]/.test(expression) ? (
            <AmountText amountMinor={amountMinor} currency={currency} />
          ) : null}
        </Card>

        <Card style={styles.rows}>
          {!isTransfer && !splitting ? (
            <FormRow
              label={t('form.category')}
              value={category ? `${categoryGroup?.name ?? ''} · ${category.name}` : ''}
              placeholder={t('form.selectCategory')}
              leading={
                category ? (
                  <CategoryIcon
                    name={category.icon}
                    color={categoryGroup?.color ?? colors.primary}
                    size={32}
                  />
                ) : (
                  <Ionicons name="grid-outline" size={22} color={colors.textMuted} />
                )
              }
              onPress={() => setPicker('category')}
            />
          ) : null}
          {!isTransfer && splitting ? (
            <View style={styles.split}>
              <AppText variant="caption" color="textSecondary">
                {t('form.splitHint')}
              </AppText>
              {allocations.map((allocation, index) => {
                const allocationCategoryItem = allocationCategory(allocation.categoryId);
                const allocationGroup = groups.find(
                  (group) => group.id === allocationCategoryItem?.groupId,
                );
                return (
                  <View key={index} style={styles.splitItem}>
                    <FormRow
                      label={t('form.splitCategory', { number: index + 1 })}
                      value={
                        allocationCategoryItem
                          ? `${allocationGroup?.name ?? ''} · ${allocationCategoryItem.name}`
                          : ''
                      }
                      placeholder={t('form.selectCategory')}
                      leading={
                        allocationCategoryItem ? (
                          <CategoryIcon
                            name={allocationCategoryItem.icon}
                            color={allocationGroup?.color ?? colors.primary}
                            size={32}
                          />
                        ) : (
                          <Ionicons name="grid-outline" size={22} color={colors.textMuted} />
                        )
                      }
                      onPress={() => setPicker({ allocationIndex: index })}
                    />
                    <TextField
                      label={t('form.splitAmount')}
                      value={allocation.amount}
                      onChangeText={(amount) =>
                        setAllocations((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, amount } : item,
                          ),
                        )
                      }
                      keyboardType="numbers-and-punctuation"
                    />
                    {allocations.length > 2 ? (
                      <Button
                        variant="danger"
                        title={t('form.removeSplit')}
                        onPress={() =>
                          setAllocations((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      />
                    ) : null}
                  </View>
                );
              })}
              <AppText variant="caption" color="textSecondary">
                {t('form.splitSummary', {
                  allocated: splitTotal === null ? '—' : minorToInput(splitTotal),
                  total: amountMinor === null ? '—' : minorToInput(amountMinor),
                  currency,
                })}
              </AppText>
              <Button
                variant="secondary"
                title={t('form.addSplit')}
                onPress={() =>
                  setAllocations((current) => [
                    ...current,
                    { categoryId: null, amount: '0.00' },
                  ])
                }
              />
            </View>
          ) : null}
          {!isTransfer ? (
            <Button
              variant="secondary"
              title={splitting ? t('form.useSingleCategory') : t('form.splitCategories')}
              onPress={toggleSplit}
            />
          ) : null}
          <FormRow
            label={isTransfer ? t('form.fromAccount') : t('form.account')}
            value={account?.name}
            placeholder={isTransfer ? t('form.selectAccount') : t('form.noAccount')}
            leading={
              account ? (
                <CategoryIcon name={account.icon} color={account.color} size={32} />
              ) : (
                <Ionicons name="wallet-outline" size={22} color={colors.textMuted} />
              )
            }
            onPress={() => setPicker('account')}
          />
          {!isTransfer && !account ? (
            <TextField
              label={t('accounts.currency')}
              value={unassignedCurrency}
              onChangeText={(value) => setUnassignedCurrency(value.toUpperCase())}
              maxLength={3}
              autoCapitalize="characters"
            />
          ) : null}
          {isTransfer ? (
            <FormRow
              label={t('form.toAccount')}
              value={transferAccount?.name}
              placeholder={t('form.selectAccount')}
              leading={
                transferAccount ? (
                  <CategoryIcon
                    name={transferAccount.icon}
                    color={transferAccount.color}
                    size={32}
                  />
                ) : (
                  <Ionicons name="swap-horizontal" size={22} color={colors.textMuted} />
                )
              }
              onPress={() => setPicker('transferAccount')}
            />
          ) : (
            <FormRow
              label={t('form.merchant')}
              value={merchant?.name}
              placeholder={t('form.noMerchant')}
              leading={<Ionicons name="storefront-outline" size={22} color={colors.textMuted} />}
              onPress={() => setPicker('merchant')}
            />
          )}
          <FormRow
            label={t('form.date')}
            value={new Date(occurredAt).toLocaleDateString(locale, {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            leading={<Ionicons name="calendar-outline" size={22} color={colors.textMuted} />}
            onPress={() => openDialog('date')}
          />
          <FormRow
            label={t('form.time')}
            value={new Date(occurredAt).toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit',
            })}
            leading={<Ionicons name="time-outline" size={22} color={colors.textMuted} />}
            onPress={() => openDialog('time')}
          />
          <FormRow
            label={t('form.tags')}
            value={selectedTags.map((tag) => `#${tag.name}`).join('  ')}
            placeholder={t('form.noTags')}
            leading={<Ionicons name="pricetag-outline" size={22} color={colors.textMuted} />}
            onPress={() => setPicker('tags')}
          />
        </Card>

        <TextField
          label={t('form.note')}
          value={note}
          onChangeText={setNote}
          placeholder={t('form.notePlaceholder')}
          multiline
          onFocus={() => setNoteFocused(true)}
          onBlur={() => setNoteFocused(false)}
        />

        {transactionId !== undefined ? (
          <Button variant="danger" title={t('common.delete')} onPress={remove} />
        ) : null}
      </ScrollView>

      {!noteFocused ? (
        <View
          style={[
            styles.bottom,
            { borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <AmountKeypad expression={expression} onChange={setExpression} />
          <Button title={t('common.save')} onPress={save} />
        </View>
      ) : null}

      {picker === 'category' ? (
        <CategoryPickerModal
          kind={type === 'income' ? 'income' : 'expense'}
          selectedId={categoryId}
          onSelect={setCategoryId}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker !== null && typeof picker === 'object' ? (
        <CategoryPickerModal
          kind={type === 'income' ? 'income' : 'expense'}
          selectedId={allocations[picker.allocationIndex]?.categoryId ?? null}
          onSelect={(id) =>
            setAllocations((current) =>
              current.map((item, index) =>
                index === picker.allocationIndex ? { ...item, categoryId: id } : item,
              ),
            )
          }
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'account' ? (
        <AccountPickerModal
          selectedId={accountId}
          onSelect={(id) => {
            setAccountId(id);
            setUnassignedCurrency(accounts.find((item) => item.id === id)?.currency ?? unassignedCurrency);
          }}
          onClear={!isTransfer ? () => setAccountId(null) : undefined}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'transferAccount' ? (
        <AccountPickerModal
          selectedId={transferAccountId}
          excludeId={effectiveAccountId}
          onSelect={setTransferAccountId}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'merchant' ? (
        <MerchantPickerModal
          selectedId={merchantId}
          onSelect={(id) => {
            setMerchantId(id);
            // A merchant with a default category fills it in when none was chosen yet.
            const defaultCategory = merchants.find((m) => m.id === id)?.defaultCategoryId;
            if (categoryId === null && defaultCategory) setCategoryId(defaultCategory);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'tags' ? (
        <TagPickerModal selectedIds={tagIds} onChange={setTagIds} onClose={() => setPicker(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  amountCard: { gap: spacing.xs, alignItems: 'flex-end' },
  rows: { paddingVertical: 0 },
  split: { gap: spacing.sm, paddingVertical: spacing.md },
  splitItem: { gap: spacing.xs, paddingBottom: spacing.sm },
  bottom: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
