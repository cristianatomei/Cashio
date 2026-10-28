import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, Chip, EmptyState, ListRow, SectionHeader } from '@/core/ui';
import {
  AssignMerchantModal,
  bucketDrafts,
  useCaptureRefresh,
  type UnknownMerchantGroup,
} from '@/features/capture';
import { suggestMerchantName } from '@/features/parsing';
import {
  groupByDay,
  useDraftViews,
  BatchToolbar,
  WorkflowList,
  SwipeDraftRow,
  SelectableTransactionRow,
  useBatchWorkflow,
} from '@/features/transactions';

export default function InboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const refresh = useCaptureRefresh();
  const drafts = useDraftViews();
  const { unknownMerchants } = useMemo(() => bucketDrafts(drafts), [drafts]);
  const [assigning, setAssigning] = useState<UnknownMerchantGroup | null>(null);
  const workflow = useBatchWorkflow(drafts.map((draft) => draft.id));

  return (
    <>
      <WorkflowList
        topInset={false}
        title={t('inbox.title')}
        groups={groupByDay(drafts)}
        onRefresh={refresh}
        empty={
          <EmptyState
            icon="checkmark-done-outline"
            title={t('inbox.emptyTitle')}
            body={t('inbox.emptyBody')}
          />
        }
        header={
          <>
            <AppText>{t('workflows.remaining', { count: drafts.length })}</AppText>
            <AppText variant="caption">{t('workflows.swipeHint')}</AppText>
            <Chip
              label={t('workflows.select')}
              selected={workflow.selecting}
              onPress={() => (workflow.selecting ? workflow.clear() : workflow.setSelecting(true))}
            />
            {workflow.selecting ? (
              <BatchToolbar
                inbox
                count={workflow.ids.length}
                disabled={!!workflow.undo}
                onApply={workflow.apply}
                onSelectAll={workflow.selectAll}
                onClear={workflow.clear}
              />
            ) : null}
            {unknownMerchants.length ? (
              <>
                <SectionHeader title={t('inbox.newMerchants')} />
                <AppText variant="caption">{t('inbox.newMerchantsHint')}</AppText>
                <Card>
                  {unknownMerchants.map((group) => (
                    <ListRow
                      key={group.key}
                      title={suggestMerchantName(group.merchantRaw)}
                      subtitle={t('inbox.payments', { count: group.items.length })}
                      onPress={workflow.undo ? undefined : () => setAssigning(group)}
                    />
                  ))}
                </Card>
              </>
            ) : null}
            {!workflow.selecting && drafts.length > 0 ? (
              <Button
                title={t('workflows.selectAll')}
                variant="secondary"
                onPress={() => {
                  workflow.setSelecting(true);
                  workflow.selectAll();
                }}
              />
            ) : null}
          </>
        }
        renderRow={(view) => (
          <SwipeDraftRow
            disabled={workflow.selecting || !!workflow.undo}
            onConfirm={() => workflow.apply({ kind: 'confirm' }, [view.id])}
            onIgnore={() => workflow.apply({ kind: 'delete' }, [view.id])}
          >
            <SelectableTransactionRow
              view={view}
              selecting={workflow.selecting}
              selected={workflow.ids.includes(view.id)}
              onToggle={() => workflow.toggle(view.id)}
              onPress={() =>
                router.push({ pathname: '/add-transaction', params: { id: String(view.id) } })
              }
            />
          </SwipeDraftRow>
        )}
      >
        {workflow.snackbar}
      </WorkflowList>
      {assigning ? (
        <AssignMerchantModal
          group={assigning}
          onClose={() => setAssigning(null)}
          onAssign={(input) =>
            workflow.associate(
              assigning.items.map((row) => row.id),
              input,
            )
          }
          onDismiss={() =>
            workflow.apply(
              { kind: 'delete' },
              assigning.items.map((row) => row.id),
            )
          }
        />
      ) : null}
    </>
  );
}
