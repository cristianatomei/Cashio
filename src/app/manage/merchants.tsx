import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, EmptyState, ListRow, Screen, TextField, useTheme } from '@/core/ui';
import {
  MerchantFormModal,
  useMerchants,
  type Merchant,
} from '@/features/merchants';
import { useCaptureRefresh } from '@/features/capture';

export default function MerchantsScreen() {
  const { t } = useTranslation();
  const refresh = useCaptureRefresh();
  const { colors } = useTheme();
  const merchants = useMerchants();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Merchant | 'new' | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = merchants.filter((merchant) => merchant.name.toLowerCase().includes(needle));

  return (
    <Screen topInset={false} onRefresh={refresh}>
      <Stack.Screen options={{ title: t('merchants.title') }} />
      <Button title={t('merchants.add')} onPress={() => setEditing('new')} />
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={t('merchants.searchPlaceholder')}
      />
      {merchants.length === 0 ? (
        <EmptyState
          icon="storefront-outline"
          title={t('merchants.emptyTitle')}
          body={t('merchants.emptyBody')}
        />
      ) : (
        <Card>
          {visible.map((merchant) => (
            <ListRow
              key={merchant.id}
              title={merchant.name}
              leading={<Ionicons name="storefront-outline" size={24} color={colors.primary} />}
              onPress={() => setEditing(merchant)}
            />
          ))}
        </Card>
      )}
      {editing ? (
        <MerchantFormModal
          merchant={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  );
}
