import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AccountFormModal,
  useAccountBalances,
  useAccounts,
  type Account,
} from '@/features/accounts';
import { AmountText, Button, Card, CategoryIcon, ListRow, Screen } from '@/core/ui';
import { useCaptureRefresh } from '@/features/capture';

export default function AccountsScreen() {
  const { t } = useTranslation();
  const refresh = useCaptureRefresh();
  const accounts = useAccounts({ includeArchived: true });
  const balances = useAccountBalances();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);

  return (
    <Screen topInset={false} onRefresh={refresh}>
      <Stack.Screen options={{ title: t('accounts.title') }} />
      <Button title={t('accounts.add')} onPress={() => setEditing('new')} />
      <Card>
        {accounts.map((account) => (
          <ListRow
            key={account.id}
            title={account.name}
            subtitle={[
              t(`accounts.type.${account.type}`),
              account.currency,
              account.archived ? t('common.archivedLabel') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            leading={
              <CategoryIcon
                name={account.icon}
                color={account.archived ? '#94A3B8' : account.color}
              />
            }
            trailing={
              <AmountText amountMinor={balances.get(account.id) ?? 0} currency={account.currency} />
            }
            onPress={() => setEditing(account)}
          />
        ))}
      </Card>
      {editing ? (
        <AccountFormModal
          account={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  );
}
