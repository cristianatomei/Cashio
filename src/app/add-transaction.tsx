import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { loadTransaction, TransactionForm } from '@/features/transactions';
import { AppText, Screen } from '@/core/ui';
import { useDb } from '@/core/db';

export default function AddTransactionScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const transactionId = id ? Number(id) : undefined;
  const db = useDb();
  if (
    id !== undefined &&
    (!/^[1-9]\d*$/.test(id) ||
      !Number.isSafeInteger(transactionId) ||
      !loadTransaction(db, transactionId!))
  ) {
    return (
      <Screen>
        <AppText>{t('workflows.missingTransaction')}</AppText>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: transactionId ? t('form.editTitle') : t('form.newTitle') }} />
      <TransactionForm key={id ?? 'new'} transactionId={transactionId} />
    </>
  );
}
