import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useDb } from '@/core/db';
import { AppText, Button, Card, ListRow, SectionHeader } from '@/core/ui';
import { AccountPickerModal, useAccounts } from '@/features/accounts';

import { importIngTransactions } from '../data/ingTransactions';
import { parseIngCsv, type IngTransactionRow } from '../domain/ingCsv';

export function IngCsvImportCard() {
  const { t } = useTranslation();
  const db = useDb();
  const accounts = useAccounts();
  const [busy, setBusy] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [pendingRows, setPendingRows] = useState<IngTransactionRow[] | null>(null);
  const [skippedRows, setSkippedRows] = useState(0);

  const effectiveAccountId = selectedAccountId ?? accounts[0]?.id ?? null;
  const selectedAccount = accounts.find((account) => account.id === effectiveAccountId);

  const chooseCsv = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', '.csv'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error('The selected CSV file is unavailable.');
      const content = new File(asset.uri).textSync();
      const parsed = parseIngCsv(content);
      if (!accounts.length) throw new Error('Create an account before importing transactions.');
      setPendingRows(parsed.rows);
      setSkippedRows(parsed.skippedRows);
      setShowAccountPicker(true);
    } catch (error) {
      console.error('Failed to import ING CSV', error);
      Alert.alert(t('errors.generic'), t('data.csvError'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCsvImport = () => {
    if (!pendingRows || effectiveAccountId === null) return;
    try {
      const result = importIngTransactions(db, effectiveAccountId, pendingRows);
      setPendingRows(null);
      setSkippedRows(0);
      Alert.alert(
        t('data.csvTitle'),
        t('data.csvResult', {
          imported: result.imported,
          duplicates: result.duplicates,
          mismatched: result.currencyMismatches,
          skipped: skippedRows,
        }),
      );
    } catch (error) {
      console.error('Failed to save imported ING transactions', error);
      Alert.alert(t('errors.generic'), t('data.csvError'));
    }
  };

  return (
    <>
      <SectionHeader title={t('data.csvTitle')} />
      <Card>
        <AppText color="textSecondary">{t('data.csvHint')}</AppText>
        <Button title={t('data.csvAction')} onPress={chooseCsv} loading={busy} />
        {selectedAccount ? (
          <ListRow
            title={selectedAccount.name}
            subtitle={`${selectedAccount.currency} · ${t('data.accountHint')}`}
            onPress={() => setShowAccountPicker(true)}
          />
        ) : null}
        {pendingRows ? (
          <>
            <AppText color="textSecondary">
              {t('data.csvPreview', { count: pendingRows.length, skipped: skippedRows })}
            </AppText>
            <Button
              title={t('data.csvConfirm')}
              onPress={confirmCsvImport}
              disabled={effectiveAccountId === null}
            />
            <Button
              title={t('common.cancel')}
              onPress={() => {
                setPendingRows(null);
                setSkippedRows(0);
              }}
              variant="secondary"
            />
          </>
        ) : null}
      </Card>
      {showAccountPicker ? (
        <AccountPickerModal
          selectedId={effectiveAccountId}
          onSelect={setSelectedAccountId}
          onClose={() => setShowAccountPicker(false)}
        />
      ) : null}
    </>
  );
}
