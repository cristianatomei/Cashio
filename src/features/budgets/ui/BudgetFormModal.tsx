import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { DEFAULT_CURRENCY, useDb } from '@/core/db';
import {
  AppText,
  Button,
  FormRow,
  SegmentedControl,
  SheetModal,
  SwitchRow,
  TextField,
} from '@/core/ui';
import { minorToInput } from '@/core/utils/money';
import { CategoryPickerModal, useTaxonomy } from '@/features/categories';

import { parseBudgetAmount, saveBudget } from '../data/budgetsRepo';
import type { BudgetView } from '../data/queries';

type Props = { budget?: BudgetView; onClose: () => void };
type Picker = 'category' | 'group' | null;

export function BudgetFormModal({ budget, onClose }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const groups = useTaxonomy({ kind: 'expense', includeArchived: true });
  const initialTargetType = budget?.categoryId === null ? 'group' : 'category';
  const [targetType, setTargetType] = useState<'category' | 'group'>(
    budget ? initialTargetType : 'category',
  );
  const [categoryId, setCategoryId] = useState<number | null>(budget?.categoryId ?? null);
  const [groupId, setGroupId] = useState<number | null>(budget?.groupId ?? null);
  const [amount, setAmount] = useState(minorToInput(budget?.amountMinor ?? 0));
  const [currency, setCurrency] = useState(budget?.currency ?? DEFAULT_CURRENCY);
  const [rollover, setRollover] = useState(budget?.rollover ?? false);
  const [picker, setPicker] = useState<Picker>(null);
  const parsedAmount = parseBudgetAmount(amount);
  const selectedCategory = groups
    .flatMap((group) => group.categories)
    .find((category) => category.id === categoryId);
  const selectedGroup = groups.find((group) => group.id === groupId);
  const validTarget = targetType === 'category' ? categoryId !== null : groupId !== null;
  const canSave =
    validTarget &&
    parsedAmount !== null &&
    parsedAmount > 0 &&
    /^[A-Za-z]{3}$/.test(currency.trim());

  const save = () => {
    if (!canSave || parsedAmount === null) return;
    try {
      saveBudget(db, {
        id: budget?.id,
        categoryId: targetType === 'category' ? categoryId : null,
        groupId: targetType === 'group' ? groupId : null,
        amountMinor: parsedAmount,
        currency: currency.trim().toUpperCase(),
        rollover,
      });
      onClose();
    } catch (error) {
      const duplicate = error instanceof Error && error.message.includes('already exists');
      if (!duplicate) console.error('Failed to save budget', error);
      Alert.alert(t('errors.generic'), duplicate ? t('budgets.duplicate') : t('budgets.saveError'));
    }
  };

  return (
    <SheetModal
      visible
      title={budget ? t('budgets.edit') : t('budgets.add')}
      onClose={onClose}
      footer={<Button title={t('common.save')} onPress={save} disabled={!canSave} />}
    >
      <AppText variant="caption" color="textSecondary">
        {t('budgets.target')}
      </AppText>
      <SegmentedControl
        value={targetType}
        onChange={(next) => {
          setTargetType(next);
          if (next === 'category') setGroupId(null);
          else setCategoryId(null);
        }}
        options={[
          { value: 'category', label: t('stats.categories') },
          { value: 'group', label: t('stats.groups') },
        ]}
      />
      {targetType === 'category' ? (
        <FormRow
          label={t('form.category')}
          value={selectedCategory?.name}
          placeholder={t('form.selectCategory')}
          onPress={() => setPicker('category')}
        />
      ) : (
        <FormRow
          label={t('categories.group')}
          value={selectedGroup?.name}
          placeholder={t('budgets.selectGroup')}
          onPress={() => setPicker('group')}
        />
      )}
      <TextField
        label={t('budgets.amount')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numbers-and-punctuation"
      />
      <TextField
        label={t('accounts.currency')}
        value={currency}
        onChangeText={(value) => setCurrency(value.toUpperCase())}
        maxLength={3}
        autoCapitalize="characters"
      />
      <SwitchRow label={t('budgets.rollover')} value={rollover} onValueChange={setRollover} />
      {picker === 'category' ? (
        <CategoryPickerModal
          kind="expense"
          selectedId={categoryId}
          onSelect={setCategoryId}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'group' ? (
        <SheetModal visible title={t('budgets.selectGroup')} onClose={() => setPicker(null)}>
          {groups.map((group) => (
            <FormRow
              key={group.id}
              label={group.name}
              value={group.id === groupId ? t('common.selected') : undefined}
              onPress={() => {
                setGroupId(group.id);
                setPicker(null);
              }}
            />
          ))}
        </SheetModal>
      ) : null}
    </SheetModal>
  );
}
