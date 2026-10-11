import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TransactionForm } from '@/features/transactions';

export default function AddTransactionScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const transactionId = id ? Number(id) : undefined;

  return (
    <>
      <Stack.Screen options={{ title: transactionId ? t('form.editTitle') : t('form.newTitle') }} />
      <TransactionForm key={id ?? 'new'} transactionId={transactionId} />
    </>
  );
}
