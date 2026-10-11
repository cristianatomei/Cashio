import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useDb } from '@/core/db';
import { Button, FormRow, SheetModal, TextField, confirmDestructive } from '@/core/ui';
import { CategoryPickerModal, useTaxonomy } from '@/features/categories';

import { deleteMerchant, saveMerchant, type Merchant } from '../data/merchantsRepo';

type Props = { merchant?: Merchant; onClose: () => void };

export function MerchantFormModal({ merchant, onClose }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const groups = useTaxonomy({ kind: 'expense', includeArchived: true });
  const [name, setName] = useState(merchant?.name ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(merchant?.defaultCategoryId ?? null);
  const [picking, setPicking] = useState(false);

  const categoryName =
    groups.flatMap((g) => g.categories).find((c) => c.id === categoryId)?.name ?? '';

  const save = () => {
    if (!name.trim()) return;
    try {
      saveMerchant(db, { id: merchant?.id, name, defaultCategoryId: categoryId });
      onClose();
    } catch {
      Alert.alert(t('dialogs.duplicateTitle'), t('dialogs.duplicateBody'));
    }
  };

  const remove = () => {
    if (!merchant) return;
    confirmDestructive({
      title: t('dialogs.deleteTitle'),
      message: t('dialogs.deleteBody', { name: merchant.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        deleteMerchant(db, merchant.id);
        onClose();
      },
    });
  };

  return (
    <>
      <SheetModal
        visible
        title={merchant ? t('merchants.edit') : t('merchants.add')}
        onClose={onClose}
        footer={<Button title={t('common.save')} onPress={save} disabled={!name.trim()} />}
      >
        <TextField label={t('common.name')} value={name} onChangeText={setName} />
        <FormRow
          label={t('merchants.defaultCategory')}
          value={categoryName}
          placeholder={t('common.none')}
          onPress={() => setPicking(true)}
        />
        {merchant ? <Button variant="danger" title={t('common.delete')} onPress={remove} /> : null}
      </SheetModal>
      {picking ? (
        <CategoryPickerModal
          kind="expense"
          selectedId={categoryId}
          onSelect={setCategoryId}
          onClear={() => setCategoryId(null)}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </>
  );
}
