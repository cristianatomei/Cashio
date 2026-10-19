import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AmountText, AppText, Card, EmptyState, ListRow, Screen, SectionHeader, useTheme } from '@/core/ui';
import {
  AssignMerchantModal,
  bucketDrafts,
  useCaptureRefresh,
  type UnknownMerchantGroup,
} from '@/features/capture';
import { suggestMerchantName } from '@/features/parsing';
import { TransactionRow, useDraftViews } from '@/features/transactions';

export default function InboxScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const refresh = useCaptureRefresh();
  const drafts = useDraftViews();
  const { unknownMerchants, others } = useMemo(() => bucketDrafts(drafts), [drafts]);
  const [assigning, setAssigning] = useState<UnknownMerchantGroup | null>(null);

  return (
    <Screen
      topInset={false}
      onRefresh={refresh}
    >
      {drafts.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title={t('inbox.emptyTitle')}
          body={t('inbox.emptyBody')}
        />
      ) : null}

      {unknownMerchants.length > 0 ? (
        <>
          <SectionHeader title={t('inbox.newMerchants')} />
          <AppText variant="caption" color="textSecondary">
            {t('inbox.newMerchantsHint')}
          </AppText>
          <Card>
            {unknownMerchants.map((group) => (
              <ListRow
                key={group.key}
                title={suggestMerchantName(group.merchantRaw)}
                subtitle={t('inbox.payments', { count: group.items.length })}
                leading={<Ionicons name="help-circle-outline" size={28} color={colors.warning} />}
                trailing={
                  <AmountText amountMinor={group.totalMinor} currency={group.currency} type="expense" />
                }
                onPress={() => setAssigning(group)}
              />
            ))}
          </Card>
        </>
      ) : null}

      {others.length > 0 ? (
        <>
          <SectionHeader title={t('inbox.others')} />
          <AppText variant="caption" color="textSecondary">
            {t('inbox.othersHint')}
          </AppText>
          <Card>
            {others.map((view) => (
              <TransactionRow
                key={view.id}
                view={view}
                onPress={() =>
                  router.push({ pathname: '/add-transaction', params: { id: String(view.id) } })
                }
              />
            ))}
          </Card>
        </>
      ) : null}

      {assigning ? <AssignMerchantModal group={assigning} onClose={() => setAssigning(null)} /> : null}
    </Screen>
  );
}
