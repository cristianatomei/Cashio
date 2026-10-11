import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDb } from '@/core/db';
import {
  AmountText,
  AppText,
  Button,
  Chip,
  FormRow,
  SheetModal,
  confirmDestructive,
} from '@/core/ui';
import { CategoryPickerModal, useTaxonomy } from '@/features/categories';
import { MerchantPickerModal, useMerchants } from '@/features/merchants';
import { suggestMerchantName } from '@/features/parsing';

import { associateMerchant, dismissDrafts } from '../data/associate';
import type { UnknownMerchantGroup } from '../domain/grouping';

type Props = { group: UnknownMerchantGroup; onClose: () => void };

export function AssignMerchantModal({ group, onClose }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const merchants = useMerchants();
  const kind = group.items[0]?.type === 'income' ? 'income' : 'expense';
  const groups = useTaxonomy({ kind, includeArchived: true });

  const [merchantId, setMerchantId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [remember, setRemember] = useState(true);
  const [picker, setPicker] = useState<'merchant' | 'category' | null>(null);

  const merchant = merchants.find((m) => m.id === merchantId);
  const category = groups.flatMap((g) => g.categories).find((c) => c.id === categoryId);
  const suggestion = suggestMerchantName(group.merchantRaw);

  const chooseMerchant = (id: number | null) => {
    setMerchantId(id);
    const defaultCategory = merchants.find((m) => m.id === id)?.defaultCategoryId;
    if (defaultCategory) setCategoryId(defaultCategory);
  };

  const save = () => {
    if (merchantId === null || categoryId === null) return;
    associateMerchant(db, { merchantRaw: group.merchantRaw, merchantId, categoryId, remember });
    onClose();
  };

  const dismiss = () =>
    confirmDestructive({
      title: t('inbox.dismissTitle'),
      message: t('inbox.dismissBody', { count: group.items.length }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        dismissDrafts(db, group.merchantRaw);
        onClose();
      },
    });

  return (
    <>
      <SheetModal
        visible
        title={suggestion}
        onClose={onClose}
        footer={
          <Button
            title={t('inbox.assign')}
            onPress={save}
            disabled={merchantId === null || categoryId === null}
          />
        }
      >
        <AppText color="textSecondary">
          {t('inbox.seenAs', { name: group.merchantRaw, count: group.items.length })}
        </AppText>
        <AmountText amountMinor={group.totalMinor} currency={group.currency} variant="heading" />
        <FormRow
          label={t('inbox.merchant')}
          value={merchant?.name}
          placeholder={t('inbox.selectMerchant')}
          onPress={() => setPicker('merchant')}
        />
        <FormRow
          label={t('inbox.category')}
          value={category?.name}
          placeholder={t('inbox.selectCategory')}
          onPress={() => setPicker('category')}
        />
        <Chip
          label={t('inbox.remember')}
          selected={remember}
          onPress={() => setRemember((value) => !value)}
        />
        <Button variant="danger" title={t('inbox.dismiss')} onPress={dismiss} />
      </SheetModal>
      {picker === 'merchant' ? (
        <MerchantPickerModal
          selectedId={merchantId}
          initialQuery={suggestion}
          onSelect={chooseMerchant}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'category' ? (
        <CategoryPickerModal
          kind={kind}
          selectedId={categoryId}
          onSelect={setCategoryId}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </>
  );
}
