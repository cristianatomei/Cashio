import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Switch, View } from 'react-native';

import { DEFAULT_CURRENCY, schema, useDb } from '@/core/db';
import { requestLocalNotificationPermission } from '@/core/notifications';
import {
  AmountText,
  AppText,
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  TextField,
  useTheme,
} from '@/core/ui';
import { AccountPickerModal, useAccounts } from '@/features/accounts';
import { useCaptureRefresh } from '@/features/capture';
import {
  installmentTotal,
  parseIngLoanSchedule,
  parseStoredLoanSchedule,
  saveLoanSchedule,
  upcomingInstallments,
  type LoanSchedule,
} from '@/features/loans';
import { syncLoanScheduleReminders } from '@/features/loans/data/loanReminders';
import { extractLoanPdfText } from '@modules/loan-pdf';
import {
  createCashioBackup,
  importIngTransactions,
  parseCashioBackup,
  parseIngCsv,
  restoreCashioBackup,
  type IngTransactionRow,
} from '@/features/backup';

export default function DataScreen() {
  const { t, i18n } = useTranslation();
  const refresh = useCaptureRefresh();
  const { setPreference } = useTheme();
  const sqlite = useSQLiteContext();
  const db = useDb();
  const accounts = useAccounts();
  const { data: rates } = useLiveQuery(db.select().from(schema.exchangeRates));
  const { data: loanSchedules } = useLiveQuery(db.select().from(schema.loanSchedules));
  const [busy, setBusy] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [pendingRows, setPendingRows] = useState<IngTransactionRow[] | null>(null);
  const [skippedRows, setSkippedRows] = useState(0);
  const [currency, setCurrency] = useState('');
  const [rate, setRate] = useState('');
  const [pendingLoanSchedule, setPendingLoanSchedule] = useState<LoanSchedule | null>(null);
  const [loanName, setLoanName] = useState('');
  const [includeInsurance, setIncludeInsurance] = useState(true);
  const [loanRemindersEnabled, setLoanRemindersEnabled] = useState(true);
  const [renderedAt] = useState(() => Date.now());
  const [rateDate, setRateDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`;
  });

  const effectiveAccountId = selectedAccountId ?? accounts[0]?.id ?? null;
  const selectedAccount = accounts.find((account) => account.id === effectiveAccountId);
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';

  const chooseLoanPdf = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(t('errors.generic'), t('data.loanAndroidOnly'));
      return;
    }
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = await extractLoanPdfText(asset.uri);
      const parsed = parseIngLoanSchedule(text);
      setPendingLoanSchedule(parsed);
      setLoanName(asset.name.replace(/\.pdf$/i, '').trim());
    } catch (error) {
      console.error('Failed to parse ING loan schedule PDF', error);
      Alert.alert(t('errors.generic'), t('data.loanParseError'));
    } finally {
      setBusy(false);
    }
  };

  const saveLoan = async () => {
    if (!pendingLoanSchedule) return;
    if (!loanName.trim()) {
      Alert.alert(t('errors.generic'), t('data.loanName'));
      return;
    }
    setBusy(true);
    try {
      if (
        loanRemindersEnabled &&
        !(await requestLocalNotificationPermission(
          'cashio_loan_schedule_reminders',
          'Cashio loan payment reminders',
        ))
      ) {
        Alert.alert(t('errors.generic'), t('data.loanReminderPermission'));
        return;
      }
      saveLoanSchedule(db, {
        name: loanName,
        currency: pendingLoanSchedule.currency,
        installments: pendingLoanSchedule.installments,
        includeInsurance,
        remindersEnabled: loanRemindersEnabled,
      });
      setPendingLoanSchedule(null);
      setLoanName('');
      try {
        await syncLoanScheduleReminders(db, {
          title: t('recurring.reminderTitle'),
          body: (name) => t('recurring.reminderBody', { name }),
        });
      } catch (error) {
        console.error('Failed to schedule loan payment reminders', error);
        Alert.alert(t('errors.generic'), t('data.loanReminderError'));
        return;
      }
      Alert.alert(t('data.loanTitle'), t('data.loanSaved'));
    } catch (error) {
      console.error('Failed to save ING loan schedule', error);
      Alert.alert(t('errors.generic'), t('data.loanSaveError'));
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = async () => {
    setBusy(true);
    try {
      const backup = await createCashioBackup(sqlite);
      const file = new File(Paths.cache, `cashio-backup-${Date.now()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(backup));
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('File sharing is unavailable on this device.');
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: t('data.backupTitle'),
      });
    } catch (error) {
      console.error('Failed to export Cashio backup', error);
      Alert.alert(t('errors.generic'), t('data.exportError'));
    } finally {
      setBusy(false);
    }
  };

  const chooseBackup = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '.json'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const source = new File(result.assets[0].uri).textSync();
      const backup = parseCashioBackup(source);
      Alert.alert(t('data.restoreAction'), t('data.restoreWarning'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('data.restoreAction'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await restoreCashioBackup(sqlite, backup);
                const savedLanguage = db
                  .select({ value: schema.appSettings.value })
                  .from(schema.appSettings)
                  .where(eq(schema.appSettings.key, 'language'))
                  .get()?.value;
                if (savedLanguage === 'ro' || savedLanguage === 'en') {
                  await i18n.changeLanguage(savedLanguage);
                }
                const savedTheme = db
                  .select({ value: schema.appSettings.value })
                  .from(schema.appSettings)
                  .where(eq(schema.appSettings.key, 'theme'))
                  .get()?.value;
                if (savedTheme === 'system' || savedTheme === 'light' || savedTheme === 'dark') {
                  setPreference(savedTheme);
                }
                Alert.alert(t('data.restoreAction'), t('data.restoreSuccess'));
              } catch (error) {
                console.error('Failed to restore Cashio backup', error);
                Alert.alert(t('errors.generic'), t('data.restoreError'));
              }
            })();
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to read Cashio backup', error);
      Alert.alert(t('errors.generic'), t('data.restoreError'));
    } finally {
      setBusy(false);
    }
  };

  const chooseCsv = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', '.csv'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const content = new File(result.assets[0].uri).textSync();
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

  const saveRate = () => {
    const code = currency.trim().toUpperCase();
    const parsedRate = Number(rate.trim().replace(',', '.'));
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rateDate);
    const effectiveDate = dateParts
      ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
      : null;
    const validDate =
      effectiveDate !== null &&
      effectiveDate.getFullYear() === Number(dateParts?.[1]) &&
      effectiveDate.getMonth() === Number(dateParts?.[2]) - 1 &&
      effectiveDate.getDate() === Number(dateParts?.[3]);
    const effectiveAt = validDate && effectiveDate ? effectiveDate.getTime() : Number.NaN;
    if (
      !/^[A-Z]{3}$/.test(code) ||
      code === baseCurrency ||
      !Number.isFinite(parsedRate) ||
      parsedRate <= 0 ||
      !Number.isFinite(effectiveAt)
    ) {
      Alert.alert(t('errors.generic'), t('data.rateInvalid'));
      return;
    }
    try {
      db.insert(schema.exchangeRates)
        .values({
          currency: code,
          rateToBase: parsedRate,
          effectiveAt,
          source: 'manual',
        })
        .onConflictDoUpdate({
          target: [schema.exchangeRates.currency, schema.exchangeRates.effectiveAt],
          set: { rateToBase: parsedRate, source: 'manual' },
        })
        .run();
      setRate('');
    } catch (error) {
      console.error('Failed to save manual exchange rate', error);
      Alert.alert(t('errors.generic'), t('data.rateError'));
    }
  };

  const baseCurrency =
    db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'base_currency'))
      .get()?.value ?? DEFAULT_CURRENCY;

  return (
    <Screen title={t('data.title')} onRefresh={refresh}>
      <SectionHeader title={t('data.backupTitle')} />
      <Card>
        <AppText color="textSecondary">{t('data.backupHint')}</AppText>
        <Button title={t('data.exportAction')} onPress={exportBackup} loading={busy} />
        <Button
          title={t('data.restoreAction')}
          onPress={chooseBackup}
          variant="secondary"
          disabled={busy}
        />
      </Card>

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
          </>
        ) : null}
      </Card>

      <SectionHeader title={t('data.loanTitle')} />
      <Card>
        <AppText color="textSecondary">{t('data.loanHint')}</AppText>
        {Platform.OS !== 'android' ? (
          <AppText color="textMuted">{t('data.loanAndroidOnly')}</AppText>
        ) : null}
        <Button
          title={t('data.loanChoosePdf')}
          onPress={chooseLoanPdf}
          loading={busy}
          disabled={Platform.OS !== 'android'}
        />
        {pendingLoanSchedule ? (
          <>
            <TextField
              label={t('data.loanName')}
              value={loanName}
              onChangeText={setLoanName}
              placeholder={t('data.loanNamePlaceholder')}
              maxLength={80}
            />
            <AppText color="textSecondary">
              {t('data.loanPreview', {
                count: pendingLoanSchedule.installments.length,
                currency: pendingLoanSchedule.currency,
              })}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AppText style={{ flex: 1 }}>{t('data.loanIncludeInsurance')}</AppText>
              <Switch value={includeInsurance} onValueChange={setIncludeInsurance} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AppText style={{ flex: 1 }}>{t('data.loanReminders')}</AppText>
              <Switch value={loanRemindersEnabled} onValueChange={setLoanRemindersEnabled} />
            </View>
            {loanRemindersEnabled ? (
              <AppText variant="caption" color="textMuted">
                {t('data.loanReminderHint')}
              </AppText>
            ) : null}
            <SectionHeader title={t('data.loanUpcoming')} />
            {upcomingInstallments(pendingLoanSchedule, renderedAt, 6).map((installment) => (
              <View key={installment.dueAt} style={{ gap: 2 }}>
                <AppText>
                  {t('data.loanDue', {
                    date: new Date(installment.dueAt).toLocaleDateString(locale),
                  })}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {t('data.loanPayment')}:{' '}
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: pendingLoanSchedule.currency,
                  }).format(installmentTotal(installment, includeInsurance) / 100)}
                  {' · '}
                  {t('data.loanInterest')}:{' '}
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: pendingLoanSchedule.currency,
                  }).format(installment.interestMinor / 100)}
                  {' · '}
                  {t('data.loanPrincipal')}:{' '}
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: pendingLoanSchedule.currency,
                  }).format(installment.principalMinor / 100)}
                  {installment.insuranceMinor > 0
                    ? ` · ${t('data.loanInsurance')}: ${new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: pendingLoanSchedule.currency,
                      }).format(installment.insuranceMinor / 100)}`
                    : ''}
                </AppText>
              </View>
            ))}
            <Button title={t('data.loanSave')} onPress={saveLoan} loading={busy} />
          </>
        ) : null}
      </Card>
      <SectionHeader title={t('data.loanSavedTitle')} />
      {loanSchedules.length === 0 ? (
        <Card>
          <AppText color="textSecondary">{t('data.loanEmpty')}</AppText>
        </Card>
      ) : (
        <Card>
          {loanSchedules.map((schedule) => {
            const stored = parseStoredLoanSchedule(schedule.installmentsJson);
            const next = upcomingInstallments(
              { currency: schedule.currency, installments: stored.installments },
              renderedAt,
              1,
            )[0];
            return (
              <View key={schedule.id} style={{ gap: 4 }}>
                <AppText variant="heading">{schedule.name}</AppText>
                {next ? (
                  <>
                    <AppText variant="caption" color="textSecondary">
                      {t('data.loanDue', {
                        date: new Date(next.dueAt).toLocaleDateString(locale),
                      })}
                    </AppText>
                    <AmountText
                      amountMinor={installmentTotal(next, stored.includeInsurance)}
                      currency={schedule.currency}
                      type="expense"
                    />
                  </>
                ) : (
                  <AppText variant="caption" color="textMuted">
                    {t('data.loanPreview', {
                      count: stored.installments.length,
                      currency: schedule.currency,
                    })}
                  </AppText>
                )}
              </View>
            );
          })}
        </Card>
      )}

      <SectionHeader title={t('data.exchangeTitle', { currency: baseCurrency })} />
      <Card>
        <TextField
          label={t('data.currencyCode')}
          value={currency}
          onChangeText={(value) => setCurrency(value.toUpperCase())}
          maxLength={3}
          autoCapitalize="characters"
        />
        <TextField
          label={t('data.rateToBase')}
          value={rate}
          onChangeText={setRate}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('data.rateDate')}
          value={rateDate}
          onChangeText={setRateDate}
          placeholder="YYYY-MM-DD"
        />
        <Button title={t('data.saveRate')} onPress={saveRate} />
        {rates.map((item) => (
          <ListRow
            key={item.id}
            title={`1 ${item.currency} = ${item.rateToBase} ${baseCurrency}`}
            subtitle={new Date(item.effectiveAt).toLocaleDateString()}
          />
        ))}
      </Card>

      {showAccountPicker ? (
        <AccountPickerModal
          selectedId={effectiveAccountId}
          onSelect={setSelectedAccountId}
          onClose={() => setShowAccountPicker(false)}
        />
      ) : null}
    </Screen>
  );
}
