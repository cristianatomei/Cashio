import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useDb } from '@/core/db';
import { AppText, ListRow, SheetModal, TextField, useTheme } from '@/core/ui';

import { findOrCreateMerchant } from '../data/merchantsRepo';
import { useMerchants } from '../data/queries';

type Props = {
  selectedId: number | null;
  /** Pre-fills the search box, e.g. with the name seen in a bank notification. */
  initialQuery?: string;
  onSelect: (merchantId: number | null) => void;
  onClose: () => void;
};

export function MerchantPickerModal({ selectedId, initialQuery = '', onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDb();
  const merchants = useMerchants();
  const [query, setQuery] = useState(initialQuery);

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const matches = merchants.filter((m) => m.name.toLowerCase().includes(needle));
  const exactExists = merchants.some((m) => m.name.toLowerCase() === needle);

  const choose = (merchantId: number | null) => {
    onSelect(merchantId);
    onClose();
  };

  const create = () => {
    try {
      choose(findOrCreateMerchant(db, trimmed));
    } catch {
      Alert.alert(t('errors.generic'));
    }
  };

  return (
    <SheetModal visible title={t('merchants.pick')} onClose={onClose}>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={t('merchants.searchPlaceholder')}
        autoFocus
      />
      {trimmed && !exactExists ? (
        <ListRow
          title={t('merchants.create', { name: trimmed })}
          leading={<Ionicons name="add-circle-outline" size={24} color={colors.primary} />}
          onPress={create}
        />
      ) : null}
      <ListRow
        title={t('common.none')}
        leading={<Ionicons name="remove-circle-outline" size={24} color={colors.textMuted} />}
        onPress={() => choose(null)}
      />
      {matches.map((merchant) => (
        <ListRow
          key={merchant.id}
          title={merchant.name}
          subtitle={merchant.id === selectedId ? t('common.selected') : undefined}
          leading={<Ionicons name="storefront-outline" size={24} color={colors.textSecondary} />}
          onPress={() => choose(merchant.id)}
        />
      ))}
      {matches.length === 0 && !trimmed ? (
        <AppText color="textSecondary">{t('merchants.emptyBody')}</AppText>
      ) : null}
    </SheetModal>
  );
}
