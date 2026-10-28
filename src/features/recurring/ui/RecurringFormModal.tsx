import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { syncRecurringReminder } from '@/features/recurring/data/reminders';
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
import { AccountPickerModal, useAccounts } from '@/features/accounts';
import { CategoryPickerModal, useTaxonomy } from '@/features/categories';
import { MerchantPickerModal, useMerchants } from '@/features/merchants';

import {
  parseRecurringAmount,
  saveRecurringRule,
  type RecurringFrequency,
  type RecurringRule,
} from '../data/recurringRepo';

type Props = { rule?: RecurringRule; onClose: () => void };
type Picker = 'account' | 'category' | 'merchant' | null;

export function RecurringFormModal({ rule, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const accounts = useAccounts();
  const merchants = useMerchants();
  const groups = useTaxonomy({ kind: 'expense' });
  const [name, setName] = useState(rule?.note ?? '');
  const [amount, setAmount] = useState(minorToInput(rule?.amountMinor ?? 0));
  const [currency, setCurrency] = useState(rule?.currency ?? DEFAULT_CURRENCY);
  const [accountId, setAccountId] = useState<number | null>(
    rule?.accountId ?? accounts[0]?.id ?? null,
  );
  const [categoryId, setCategoryId] = useState<number | null>(rule?.categoryId ?? null);
  const [merchantId, setMerchantId] = useState<number | null>(rule?.merchantId ?? null);
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule?.frequency ?? 'monthly');
  const [interval, setInterval] = useState(String(rule?.interval ?? 1));
  const [nextDue, setNextDue] = useState(() => rule?.nextDue ?? Date.now());
  const [amountVariable, setAmountVariable] = useState(rule?.amountVariable ?? false);
  const [picker, setPicker] = useState<Picker>(null);
  const parsedAmount = parseRecurringAmount(amount);
  const intervalValue = Number.parseInt(interval, 10);
  const canSave =
    accountId !== null &&
    parsedAmount !== null &&
    parsedAmount > 0 &&
    currency.trim().length === 3 &&
    Number.isInteger(intervalValue) &&
    intervalValue > 0;

  const save = async () => {
    if (!canSave || accountId === null || parsedAmount === null) return;
    const id = saveRecurringRule(db, {
      id: rule?.id,
      accountId,
      type: 'expense',
      amountMinor: parsedAmount,
      amountVariable,
      currency: currency.toUpperCase(),
      categoryId,
      merchantId,
      note: name,
      frequency,
      interval: intervalValue,
      nextDue,
    });
    try {
      await syncRecurringReminder(db, id, {
        title: t('recurring.reminderTitle'),
        body: (name) => t('recurring.reminderBody', { name }),
      });
    } catch (error) {
      console.error('Failed to sync recurring reminder', error);
      Alert.alert(t('errors.generic'), t('recurring.reminderError'));
    }
    onClose();
  };

  const dateLabel = new Date(nextDue).toLocaleDateString(
    i18n.language === 'en' ? 'en-GB' : 'ro-RO',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  );

  return (
    <SheetModal
      visible
      title={rule ? t('recurring.edit') : t('recurring.add')}
      onClose={onClose}
      footer={<Button title={t('common.save')} onPress={save} disabled={!canSave} />}
    >
      <TextField label={t('recurring.name')} value={name} onChangeText={setName} />
      <TextField
        label={t('recurring.amount')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numbers-and-punctuation"
      />
      <SwitchRow
        label={t('recurring.variableAmount')}
        value={amountVariable}
        onValueChange={setAmountVariable}
      />
      <TextField
        label={t('accounts.currency')}
        value={currency}
        onChangeText={(value) => setCurrency(value.toUpperCase())}
        maxLength={3}
        autoCapitalize="characters"
      />
      <FormRow
        label={t('form.account')}
        value={accounts.find((item) => item.id === accountId)?.name}
        onPress={() => setPicker('account')}
      />
      <FormRow
        label={t('form.category')}
        value={
          groups.flatMap((group) => group.categories).find((item) => item.id === categoryId)?.name
        }
        placeholder={t('form.selectCategory')}
        onPress={() => setPicker('category')}
      />
      <FormRow
        label={t('form.merchant')}
        value={merchants.find((item) => item.id === merchantId)?.name}
        placeholder={t('form.noMerchant')}
        onPress={() => setPicker('merchant')}
      />
      <AppText variant="caption" color="textSecondary">
        {t('recurring.frequency')}
      </AppText>
      <SegmentedControl
        value={frequency}
        onChange={setFrequency}
        options={[
          { value: 'monthly', label: t('recurring.monthly') },
          { value: 'yearly', label: t('recurring.yearly') },
        ]}
      />
      <TextField
        label={t('recurring.interval')}
        value={interval}
        onChangeText={setInterval}
        keyboardType="number-pad"
      />
      <FormRow
        label={t('recurring.nextDue')}
        value={dateLabel}
        onPress={() =>
          DateTimePickerAndroid.open({
            value: new Date(nextDue),
            mode: 'date',
            onChange: (event, date) => {
              if (event.type === 'set' && date) setNextDue(date.getTime());
            },
          })
        }
      />
      {picker === 'account' ? (
        <AccountPickerModal
          selectedId={accountId}
          onSelect={setAccountId}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'category' ? (
        <CategoryPickerModal
          kind="expense"
          selectedId={categoryId}
          onSelect={setCategoryId}
          onClear={() => setCategoryId(null)}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'merchant' ? (
        <MerchantPickerModal
          selectedId={merchantId}
          onSelect={setMerchantId}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </SheetModal>
  );
}
