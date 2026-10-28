import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useDb } from '@/core/db';
import { AppText, Button, spacing, useTheme } from '@/core/ui';

import {
  applyAssociation,
  applyBatch,
  undoBatch,
  type BatchAction,
  type BatchUndo,
} from '../data/workflowsRepo';
import type { AssociateInput } from '@/features/capture/data/associate';
import { transactionTitle, type TransactionView } from '../domain/views';
import { TransactionRow } from './TransactionRow';
import { cleanupReceipts } from '@/features/receipts/data/repo';
import { i18next } from '@/core/i18n';
import { ReceiptError } from '@/features/receipts/domain/receipt';

export function useBatchWorkflow(visibleIds: number[]) {
  const { t } = useTranslation();
  const db = useDb();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [undo, setUndo] = useState<BatchUndo | null>(null);
  const pendingUndo = useRef<BatchUndo | null>(null);
  useEffect(() => {
    pendingUndo.current = undo;
  }, [undo]);
  const finish = (action: BatchUndo | null) => {
    if (!action) return;
    try {
      cleanupReceipts(
        db,
        action.before.receipts.map((row) => row.filename),
      );
    } catch {
      Alert.alert(i18next.t('errors.generic'), i18next.t('receipts.cleanupFailed'));
    }
  };
  useEffect(
    () => () => {
      const action = pendingUndo.current;
      if (!action) return;
      try {
        cleanupReceipts(
          db,
          action.before.receipts.map((row) => row.filename),
        );
      } catch {
        Alert.alert(i18next.t('errors.generic'), i18next.t('receipts.cleanupFailed'));
      }
    },
    [db],
  );
  const ids = selected.filter((id) => visibleIds.includes(id));
  const haptic = () => {
    void Haptics.selectionAsync().catch((error: unknown) =>
      console.warn('Haptics unavailable', error),
    );
  };
  const apply = (action: BatchAction, targets = ids) => {
    if (undo) return;
    try {
      setUndo(applyBatch(db, targets, action));
      setSelected([]);
      setSelecting(false);
      haptic();
    } catch (error) {
      console.error('Batch action failed', error);
      Alert.alert(t('errors.generic'), t('workflows.batchError'));
    }
  };
  const snackbar = undo ? (
    <View accessibilityLiveRegion="polite" style={styles.snackbar}>
      <AppText style={{ color: '#FFFFFF' }}>
        {t('workflows.applied', { count: undo.ids.length })}
      </AppText>
      <Button
        title={t('workflows.undo')}
        onPress={() => {
          try {
            undoBatch(db, undo);
            setUndo(null);
            haptic();
          } catch (error) {
            console.error('Undo failed', error);
            Alert.alert(
              t('errors.generic'),
              error instanceof ReceiptError
                ? t(`receipts.${error.code}`)
                : t('workflows.undoError'),
            );
          }
        }}
      />
      <Button
        title={t('common.done')}
        variant="secondary"
        onPress={() => {
          finish(undo);
          setUndo(null);
        }}
      />
    </View>
  ) : null;
  return {
    selecting,
    setSelecting,
    ids,
    apply,
    undo,
    snackbar,
    associate: (targets: number[], input: AssociateInput) => {
      if (undo) return;
      try {
        setUndo(applyAssociation(db, targets, input));
        haptic();
      } catch (error) {
        console.error('Merchant association failed', error);
        Alert.alert(t('errors.generic'), t('workflows.batchError'));
      }
    },
    toggle: (id: number) => {
      setSelected((value) =>
        value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
      );
      haptic();
    },
    selectAll: () => setSelected(visibleIds),
    clear: () => {
      setSelected([]);
      setSelecting(false);
    },
  };
}

export function SelectableTransactionRow({
  view,
  selected,
  selecting,
  onToggle,
  onPress,
}: {
  view: TransactionView;
  selected: boolean;
  selecting: boolean;
  onToggle: () => void;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {selecting ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`${t('common.selected')}: ${transactionTitle(view)}`}
          onPress={onToggle}
          style={styles.check}
        >
          <AppText style={{ color: colors.primary }}>{selected ? '☑' : '☐'}</AppText>
        </Pressable>
      ) : null}
      <View style={styles.flex}>
        <TransactionRow view={view} onPress={selecting ? onToggle : onPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    margin: spacing.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: '#1E293B',
    borderRadius: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  check: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
