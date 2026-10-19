import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { DEFAULT_CURRENCY, useDb } from '@/core/db';
import {
  AppText,
  Button,
  ColorSwatches,
  IconGrid,
  SegmentedControl,
  SheetModal,
  TextField,
  confirmDestructive,
  swatchColors,
} from '@/core/ui';
import { minorToInput, parseSignedAmountToMinor } from '@/core/utils/money';
import { ACCOUNT_ICONS } from '@/features/categories';

import { isValidIban } from '../domain/iban';
import { deleteAccount, saveAccount, setAccountArchived, type Account } from '../data/accountsRepo';

type Props = { account?: Account; onClose: () => void };

export function AccountFormModal({ account, onClose }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<Account['type']>(account?.type ?? 'bank');
  const [iban, setIban] = useState(account?.iban ?? '');
  const [currency, setCurrency] = useState(account?.currency ?? DEFAULT_CURRENCY);
  const [opening, setOpening] = useState(minorToInput(account?.openingBalanceMinor ?? 0));
  const [color, setColor] = useState(account?.color ?? swatchColors[0]);
  const [icon, setIcon] = useState(account?.icon ?? ACCOUNT_ICONS[0]);

  const openingMinor = parseSignedAmountToMinor(opening);
  const ibanValid = !iban.trim() || isValidIban(iban);
  const canSave =
    name.trim().length > 0 && currency.trim().length === 3 && openingMinor !== null && ibanValid;

  const save = () => {
    if (!canSave || openingMinor === null) return;
    saveAccount(db, {
      id: account?.id,
      name,
      type,
      iban,
      currency,
      color,
      icon,
      openingBalanceMinor: openingMinor,
    });
    onClose();
  };

  const remove = () => {
    if (!account) return;
    confirmDestructive({
      title: t('dialogs.deleteTitle'),
      message: t('dialogs.deleteBody', { name: account.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        if (deleteAccount(db, account.id)) onClose();
        else Alert.alert(t('dialogs.inUseTitle'), t('dialogs.inUseBody', { name: account.name }));
      },
    });
  };

  return (
    <SheetModal
      visible
      title={account ? t('accounts.edit') : t('accounts.add')}
      onClose={onClose}
      footer={<Button title={t('common.save')} onPress={save} disabled={!canSave} />}
    >
      <TextField label={t('common.name')} value={name} onChangeText={setName} />
      <SegmentedControl
        value={type}
        onChange={setType}
        options={[
          { value: 'bank', label: t('accounts.type.bank') },
          { value: 'cash', label: t('accounts.type.cash') },
          { value: 'other', label: t('accounts.type.other') },
        ]}
      />
      {type === 'bank' ? (
        <>
          <TextField
            label={t('accounts.iban')}
            value={iban}
            onChangeText={setIban}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {iban.trim() && !ibanValid ? (
            <AppText variant="caption" color="expense">
              {t('accounts.invalidIban')}
            </AppText>
          ) : (
            <AppText variant="caption" color="textSecondary">
              {t('accounts.ibanHint')}
            </AppText>
          )}
        </>
      ) : null}
      <TextField
        label={t('accounts.currency')}
        value={currency}
        onChangeText={(text) => setCurrency(text.toUpperCase())}
        maxLength={3}
        autoCapitalize="characters"
      />
      <TextField
        label={t('accounts.openingBalance')}
        value={opening}
        onChangeText={setOpening}
        keyboardType="numbers-and-punctuation"
      />
      <AppText variant="caption" color="textSecondary">
        {t('common.color')}
      </AppText>
      <ColorSwatches value={color} onChange={setColor} />
      <AppText variant="caption" color="textSecondary">
        {t('common.icon')}
      </AppText>
      <IconGrid icons={ACCOUNT_ICONS} value={icon} color={color} onChange={setIcon} />
      {account ? (
        <>
          <Button
            variant="secondary"
            title={account.archived ? t('common.unarchive') : t('common.archive')}
            onPress={() => {
              setAccountArchived(db, account.id, !account.archived);
              onClose();
            }}
          />
          <Button variant="danger" title={t('common.delete')} onPress={remove} />
        </>
      ) : null}
    </SheetModal>
  );
}
