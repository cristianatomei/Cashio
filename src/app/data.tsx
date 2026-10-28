import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';

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
  SheetModal,
  SwitchRow,
  TextField,
  useTheme,
} from '@/core/ui';
import { useCaptureRefresh } from '@/features/capture';
import {
  installmentTotal,
  parseIngLoanSchedule,
  parseStoredLoanSchedule,
  saveLoanSchedule,
  setLoanScheduleReminders,
  updateLoanScheduleSettings,
  deleteLoanSchedule,
  upcomingInstallments,
  reconcileLoanPayments,
  type LoanSchedule,
} from '@/features/loans';
import { syncLoanScheduleReminders } from '@/features/loans/data/loanReminders';
import { extractLoanPdfText } from '@modules/loan-pdf';
import {
  createCashioBackup,
  IngCsvImportCard,
  parseCashioBackup,
  restoreCashioBackup,
  backupAgeDays,
  backupSettingKeys,
} from '@/features/backup';

export default function DataScreen() {
  const { t, i18n } = useTranslation();
  const refresh = useCaptureRefresh();
  const { setPreference } = useTheme();
  const sqlite = useSQLiteContext();
  const db = useDb();
  const { data: rates } = useLiveQuery(db.select().from(schema.exchangeRates));
  const { data: loanSchedules } = useLiveQuery(db.select().from(schema.loanSchedules));
  const { data: appSettings } = useLiveQuery(db.select().from(schema.appSettings));
  const { data: loanTransactions } = useLiveQuery(
    db
      .select({
        id: schema.transactions.id,
        type: schema.transactions.type,
        status: schema.transactions.status,
        amountMinor: schema.transactions.amountMinor,
        currency: schema.transactions.currency,
        occurredAt: schema.transactions.occurredAt,
        merchantRaw: schema.transactions.merchantRaw,
        note: schema.transactions.note,
      })
      .from(schema.transactions),
  );
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState('');
  const [rate, setRate] = useState('');
  const [pendingLoanSchedule, setPendingLoanSchedule] = useState<LoanSchedule | null>(null);
  const [loanName, setLoanName] = useState('');
  const [includeInsurance, setIncludeInsurance] = useState(true);
  const [loanRemindersEnabled, setLoanRemindersEnabled] = useState(true);
  const [editingLoanSchedule, setEditingLoanSchedule] = useState<{
    id: number;
    name: string;
    includeInsurance: boolean;
  } | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const [rateDate, setRateDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`;
  });

  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const lastBackupValue = appSettings.find(
    (setting) => setting.key === backupSettingKeys.lastAt,
  )?.value;
  const lastBackupAt =
    lastBackupValue && Number.isSafeInteger(Number(lastBackupValue))
      ? Number(lastBackupValue)
      : null;
  const lastBackupAge = backupAgeDays(lastBackupAt, renderedAt);
  const loanPaymentMatches = reconcileLoanPayments(
    loanSchedules.map((schedule) => {
      const stored = parseStoredLoanSchedule(schedule.installmentsJson);
      return {
        id: schedule.id,
        currency: schedule.currency,
        includeInsurance: stored.includeInsurance,
        installments: stored.installments,
      };
    }),
    loanTransactions,
  );

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

  const updateLoanReminders = async (scheduleId: number, enabled: boolean) => {
    setBusy(true);
    try {
      if (
        enabled &&
        !(await requestLocalNotificationPermission(
          'cashio_loan_schedule_reminders',
          'Cashio loan payment reminders',
        ))
      ) {
        Alert.alert(t('errors.generic'), t('data.loanReminderPermission'));
        return;
      }
      try {
        setLoanScheduleReminders(db, scheduleId, enabled);
      } catch (error) {
        console.error('Failed to save loan reminder setting', error);
        Alert.alert(t('errors.generic'), t('data.loanReminderToggleError'));
        return;
      }
      try {
        await syncLoanScheduleReminders(db, {
          title: t('recurring.reminderTitle'),
          body: (name) => t('recurring.reminderBody', { name }),
        });
      } catch (error) {
        console.error('Failed to refresh loan payment reminders', error);
        Alert.alert(t('errors.generic'), t('data.loanReminderResyncError'));
      }
    } catch (error) {
      console.error('Failed to update loan payment reminder permission', error);
      Alert.alert(t('errors.generic'), t('data.loanReminderToggleError'));
    } finally {
      setBusy(false);
    }
  };

  const openLoanSettings = (schedule: (typeof loanSchedules)[number]) => {
    const stored = parseStoredLoanSchedule(schedule.installmentsJson);
    setEditingLoanSchedule({
      id: schedule.id,
      name: schedule.name,
      includeInsurance: stored.includeInsurance,
    });
  };

  const saveLoanSettings = async () => {
    if (!editingLoanSchedule) return;
    setBusy(true);
    try {
      updateLoanScheduleSettings(db, editingLoanSchedule.id, editingLoanSchedule);
      setEditingLoanSchedule(null);
      try {
        await syncLoanScheduleReminders(db, {
          title: t('recurring.reminderTitle'),
          body: (name) => t('recurring.reminderBody', { name }),
        });
      } catch (error) {
        console.error('Failed to refresh loan reminders after updating schedule', error);
        Alert.alert(t('errors.generic'), t('data.loanReminderResyncError'));
      }
    } catch (error) {
      console.error('Failed to update saved loan schedule', error);
      Alert.alert(t('errors.generic'), t('data.loanUpdateError'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteLoan = (scheduleId: number) => {
    Alert.alert(t('data.loanDeleteTitle'), t('data.loanDeleteWarning'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('data.loanDelete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              try {
                deleteLoanSchedule(db, scheduleId);
              } catch (error) {
                console.error('Failed to delete loan repayment schedule', error);
                Alert.alert(t('errors.generic'), t('data.loanDeleteError'));
                return;
              }
              try {
                await syncLoanScheduleReminders(db, {
                  title: t('recurring.reminderTitle'),
                  body: (name) => t('recurring.reminderBody', { name }),
                });
              } catch (error) {
                console.error('Failed to refresh reminders after loan schedule deletion', error);
                Alert.alert(t('errors.generic'), t('data.loanDeleteReminderError'));
              }
            } catch (error) {
              console.error('Failed to delete loan repayment schedule', error);
              Alert.alert(t('errors.generic'), t('data.loanDeleteError'));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
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
        <AppText color="textSecondary">
          {lastBackupAge === null
            ? t('data.backupNever')
            : t('data.backupAge', { days: lastBackupAge })}
        </AppText>
        <Button title={t('data.exportAction')} onPress={exportBackup} loading={busy} />
        <Button
          title={t('data.restoreAction')}
          onPress={chooseBackup}
          variant="secondary"
          disabled={busy}
        />
      </Card>

      <IngCsvImportCard />

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
            <SwitchRow
              label={t('data.loanIncludeInsurance')}
              value={includeInsurance}
              onValueChange={setIncludeInsurance}
            />
            <SwitchRow
              label={t('data.loanReminders')}
              value={loanRemindersEnabled}
              onValueChange={setLoanRemindersEnabled}
            />
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
            const paymentMatches = loanPaymentMatches
              .filter((match) => match.scheduleId === schedule.id)
              .sort((left, right) => right.dueAt - left.dueAt)
              .slice(0, 6);
            const upcoming = upcomingInstallments(
              { currency: schedule.currency, installments: stored.installments },
              renderedAt,
              6,
            );
            const next = upcoming[0];
            return (
              <View key={schedule.id} style={{ gap: 8, paddingVertical: 8 }}>
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
                    <AppText variant="caption" color="textMuted">
                      {t('data.loanInterest')}:{' '}
                      {new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: schedule.currency,
                      }).format(next.interestMinor / 100)}
                      {' · '}
                      {t('data.loanPrincipal')}:{' '}
                      {new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: schedule.currency,
                      }).format(next.principalMinor / 100)}
                      {next.insuranceMinor > 0
                        ? ` · ${t('data.loanInsurance')}: ${new Intl.NumberFormat(locale, {
                            style: 'currency',
                            currency: schedule.currency,
                          }).format(next.insuranceMinor / 100)}`
                        : ''}
                    </AppText>
                  </>
                ) : (
                  <AppText variant="caption" color="textMuted">
                    {t('data.loanNoUpcoming')}
                  </AppText>
                )}
                {upcoming.slice(1).map((installment) => (
                  <View key={installment.dueAt} style={{ gap: 2 }}>
                    <AppText variant="caption">
                      {t('data.loanDue', {
                        date: new Date(installment.dueAt).toLocaleDateString(locale),
                      })}
                      {' · '}
                      {t('data.loanPayment')}:{' '}
                      {new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: schedule.currency,
                      }).format(installmentTotal(installment, stored.includeInsurance) / 100)}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {t('data.loanInterest')}:{' '}
                      {new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: schedule.currency,
                      }).format(installment.interestMinor / 100)}
                      {' · '}
                      {t('data.loanPrincipal')}:{' '}
                      {new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: schedule.currency,
                      }).format(installment.principalMinor / 100)}
                      {installment.insuranceMinor > 0
                        ? ` · ${t('data.loanInsurance')}: ${new Intl.NumberFormat(locale, {
                            style: 'currency',
                            currency: schedule.currency,
                          }).format(installment.insuranceMinor / 100)}`
                        : ''}
                    </AppText>
                  </View>
                ))}
                {paymentMatches.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <AppText variant="caption" color="textSecondary">
                      {t('data.loanPaymentCheckTitle')}
                    </AppText>
                    {paymentMatches.map((match) => {
                      const amount = (amountMinor: number) =>
                        `${new Intl.NumberFormat(locale, {
                          style: 'currency',
                          currency: schedule.currency,
                        }).format(amountMinor / 100)}`;
                      const matched = match.actualMinor === match.expectedMinor;
                      return (
                        <AppText
                          key={`${match.dueAt}-${match.transactionId}`}
                          variant="caption"
                          color={matched ? 'income' : 'expense'}
                        >
                          {matched
                            ? t('data.loanPaymentMatched', {
                                date: new Date(match.dueAt).toLocaleDateString(locale),
                                amount: amount(match.actualMinor),
                              })
                            : t('data.loanPaymentConflict', {
                                date: new Date(match.dueAt).toLocaleDateString(locale),
                                expected: amount(match.expectedMinor),
                                actual: amount(match.actualMinor),
                              })}
                        </AppText>
                      );
                    })}
                  </View>
                ) : null}
                <SwitchRow
                  label={t('data.loanReminderStatus')}
                  accessibilityLabel={`${schedule.name}: ${t('data.loanReminderStatus')}`}
                  value={stored.remindersEnabled}
                  onValueChange={(enabled) => void updateLoanReminders(schedule.id, enabled)}
                  disabled={busy}
                />
                <Button
                  title={t('data.loanEdit')}
                  variant="secondary"
                  onPress={() => openLoanSettings(schedule)}
                  disabled={busy}
                />
                <Button
                  title={t('data.loanDelete')}
                  variant="danger"
                  onPress={() => confirmDeleteLoan(schedule.id)}
                  disabled={busy}
                />
              </View>
            );
          })}
        </Card>
      )}
      {editingLoanSchedule ? (
        <SheetModal
          visible
          title={t('data.loanEdit')}
          onClose={() => setEditingLoanSchedule(null)}
          footer={
            <Button
              title={t('common.save')}
              onPress={() => void saveLoanSettings()}
              disabled={!editingLoanSchedule.name.trim()}
              loading={busy}
            />
          }
        >
          <TextField
            label={t('data.loanName')}
            value={editingLoanSchedule.name}
            onChangeText={(name) =>
              setEditingLoanSchedule((current) => (current ? { ...current, name } : current))
            }
          />
          <SwitchRow
            label={t('data.loanIncludeInsurance')}
            value={editingLoanSchedule.includeInsurance}
            onValueChange={(includeInsurance) =>
              setEditingLoanSchedule((current) =>
                current ? { ...current, includeInsurance } : current,
              )
            }
          />
        </SheetModal>
      ) : null}

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
    </Screen>
  );
}
