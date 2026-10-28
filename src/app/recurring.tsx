import { eq } from 'drizzle-orm';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { schema, useDb } from '@/core/db';
import { monthRange, startOfMonth } from '@/core/utils/dates';
import {
  AmountText,
  AppText,
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  SwitchRow,
  confirmDestructive,
  useTheme,
} from '@/core/ui';
import {
  deleteRecurringRule,
  setRecurringRemindersEnabled,
  setRecurringRuleActive,
  syncRecurringReminder,
  type RecurringRule,
  useNextMonthEstimate,
  recurringPaymentsInRange,
  useRecurringRules,
} from '@/features/recurring';
import { RecurringFormModal } from '@/features/recurring';
import { installmentTotal, parseStoredLoanSchedule } from '@/features/loans';
import { MonthSwitcher } from '@/features/transactions';
import { Alert } from 'react-native';
import { useCaptureRefresh } from '@/features/capture';

export default function RecurringScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const db = useDb();
  const refresh = useCaptureRefresh();
  const { data: reminderSetting } = useLiveQuery(
    db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'recurring_reminders_enabled')),
  );
  const rules = useRecurringRules();
  const estimate = useNextMonthEstimate();
  const [editing, setEditing] = useState<RecurringRule | null | undefined>(undefined);
  const [monthStart, setMonthStart] = useState(() => startOfMonth(Date.now()));
  const { data: loanSchedules } = useLiveQuery(db.select().from(schema.loanSchedules));
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const { from: monthFrom, to: monthTo } = monthRange(monthStart);
  const remindersEnabled = reminderSetting[0]?.value === 'true';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueWindow = today.getTime() + 30 * 24 * 60 * 60 * 1000;
  const unpaidRules = rules
    .filter((rule) => rule.active && rule.nextDue <= dueWindow)
    .sort((left, right) => left.nextDue - right.nextDue);
  const scheduledPayments = useMemo(() => {
    const recurringPayments = recurringPaymentsInRange(
      rules.map((rule) => ({
        id: rule.id,
        name: rule.note || rule.merchantName || rule.categoryName || t('recurring.obligation'),
        amountMinor: rule.amountMinor,
        currency: rule.currency,
        frequency: rule.frequency,
        interval: rule.interval,
        nextDue: rule.nextDue,
        endAt: rule.endAt,
        active: rule.active,
      })),
      monthFrom,
      monthTo,
    ).map((payment) => ({
      ...payment,
      source: 'recurring' as const,
    }));

    const loanPayments = loanSchedules.flatMap((schedule) => {
      const stored = parseStoredLoanSchedule(schedule.installmentsJson);
      return stored.installments
        .filter((installment) => installment.dueAt >= monthFrom && installment.dueAt < monthTo)
        .map((installment) => ({
          key: `loan-${schedule.id}-${installment.dueAt}`,
          name: schedule.name,
          dueAt: installment.dueAt,
          amountMinor: installmentTotal(installment, stored.includeInsurance),
          currency: schedule.currency,
          source: 'loan' as const,
        }));
    });

    return [...recurringPayments, ...loanPayments].sort(
      (left, right) => left.dueAt - right.dueAt || left.key.localeCompare(right.key),
    );
  }, [loanSchedules, monthFrom, monthTo, rules, t]);
  const scheduledTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const payment of scheduledPayments) {
      totals.set(payment.currency, (totals.get(payment.currency) ?? 0) + payment.amountMinor);
    }
    return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [scheduledPayments]);
  const reminderCopy = {
    title: t('recurring.reminderTitle'),
    body: (name: string) => t('recurring.reminderBody', { name }),
  };

  const syncReminder = async (id: number) => {
    try {
      await syncRecurringReminder(db, id, reminderCopy);
    } catch (error) {
      console.error('Failed to sync recurring reminder', error);
      Alert.alert(t('errors.generic'), t('recurring.reminderError'));
    }
  };

  const toggleReminders = async (enabled: boolean) => {
    try {
      const granted = await setRecurringRemindersEnabled(db, enabled, reminderCopy);
      if (!granted) {
        Alert.alert(t('recurring.reminderPermissionTitle'), t('recurring.reminderPermissionBody'));
      }
    } catch (error) {
      console.error('Failed to change recurring reminders', error);
      Alert.alert(t('errors.generic'), t('recurring.reminderError'));
    }
  };

  const remove = (rule: RecurringRule) =>
    confirmDestructive({
      title: t('dialogs.deleteTitle'),
      message: t('dialogs.deleteBody', { name: rule.note ?? t('recurring.obligation') }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        deleteRecurringRule(db, rule.id);
        void syncReminder(rule.id);
      },
    });

  return (
    <Screen onRefresh={refresh}>
      <Card>
        <SwitchRow
          label={t('recurring.reminders')}
          description={t('recurring.remindersHint')}
          value={remindersEnabled}
          onValueChange={(enabled) => void toggleReminders(enabled)}
        />
      </Card>
      <SectionHeader title={t('recurring.monthlySchedule')} />
      <MonthSwitcher monthStart={monthStart} onChange={setMonthStart} />
      {scheduledPayments.length === 0 ? (
        <Card>
          <AppText color="textSecondary">{t('recurring.monthlyScheduleEmpty')}</AppText>
        </Card>
      ) : (
        <Card>
          {scheduledTotals.map(([currency, amountMinor]) => (
            <ListRow
              key={`total-${currency}`}
              title={t('recurring.monthlyScheduleTotal', { currency })}
              trailing={<AmountText amountMinor={amountMinor} currency={currency} type="expense" />}
            />
          ))}
          {scheduledPayments.map((payment) => (
            <ListRow
              key={payment.key}
              title={payment.name}
              subtitle={`${new Date(payment.dueAt).toLocaleDateString(locale)} · ${t(
                payment.source === 'loan'
                  ? 'recurring.monthlyScheduleLoan'
                  : 'recurring.monthlyScheduleRecurring',
              )}`}
              leading={
                <Ionicons
                  name={payment.source === 'loan' ? 'document-text-outline' : 'repeat-outline'}
                  size={24}
                  color={colors.primary}
                />
              }
              trailing={
                <AmountText
                  amountMinor={payment.amountMinor}
                  currency={payment.currency}
                  type="expense"
                />
              }
            />
          ))}
        </Card>
      )}
      <SectionHeader title={t('recurring.payable')} />
      {unpaidRules.length === 0 ? (
        <Card>
          <AppText color="textSecondary">{t('recurring.noPayables')}</AppText>
        </Card>
      ) : (
        <Card>
          {unpaidRules.map((rule) => (
            <ListRow
              key={rule.id}
              title={
                rule.note || rule.merchantName || rule.categoryName || t('recurring.obligation')
              }
              subtitle={t(
                rule.nextDue < today.getTime() ? 'recurring.overdue' : 'recurring.dueOn',
                {
                  date: new Date(rule.nextDue).toLocaleDateString(locale),
                },
              )}
              leading={
                <Ionicons
                  name="alert-circle-outline"
                  size={24}
                  color={rule.nextDue < today.getTime() ? colors.expense : colors.warning}
                />
              }
              trailing={
                <AmountText
                  amountMinor={rule.amountMinor}
                  currency={rule.currency}
                  type="expense"
                />
              }
              onPress={() => setEditing(rule)}
            />
          ))}
        </Card>
      )}
      <SectionHeader title={t('recurring.forecast')} />
      {estimate.length === 0 ? (
        <Card>
          <AppText color="textSecondary">{t('recurring.forecastEmpty')}</AppText>
        </Card>
      ) : (
        <Card>
          {estimate.map((item) => {
            const money = new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: item.currency,
            });
            return (
              <ListRow
                key={item.currency}
                title={t('recurring.forecastTotal')}
                subtitle={t('recurring.forecastBreakdown', {
                  obligations: money.format(item.obligationsMinor / 100),
                  variable: money.format(item.variableAverageMinor / 100),
                })}
                leading={<Ionicons name="trending-up-outline" size={24} color={colors.primary} />}
                trailing={
                  <AmountText
                    amountMinor={item.totalMinor}
                    currency={item.currency}
                    type="expense"
                  />
                }
              />
            );
          })}
          {loanSchedules.length > 0 ? (
            <AppText color="textSecondary">{t('recurring.forecastLoanWarning')}</AppText>
          ) : null}
        </Card>
      )}

      <SectionHeader title={t('recurring.obligations')} />
      <Button title={t('recurring.add')} onPress={() => setEditing(null)} />
      {rules.length === 0 ? (
        <Card>
          <AppText color="textSecondary">{t('recurring.empty')}</AppText>
        </Card>
      ) : (
        rules.map((rule) => (
          <Card key={rule.id}>
            <ListRow
              title={
                rule.note || rule.merchantName || rule.categoryName || t('recurring.obligation')
              }
              subtitle={[
                rule.merchantName,
                rule.categoryName,
                rule.amountVariable ? t('recurring.variableAmount') : null,
                `${rule.interval > 1 ? `${rule.interval}× ` : ''}${t(`recurring.frequencies.${rule.frequency}`)}`,
                t('recurring.dueOn', { date: new Date(rule.nextDue).toLocaleDateString(locale) }),
              ]
                .filter(Boolean)
                .join(' · ')}
              leading={
                <Ionicons
                  name="repeat-outline"
                  size={24}
                  color={rule.active ? colors.primary : colors.textMuted}
                />
              }
              trailing={
                <AmountText
                  amountMinor={rule.amountMinor}
                  currency={rule.currency}
                  type="expense"
                />
              }
              onPress={() => setEditing(rule)}
            />
            <Button
              title={rule.active ? t('recurring.pause') : t('recurring.resume')}
              onPress={() => {
                setRecurringRuleActive(db, rule.id, !rule.active);
                void syncReminder(rule.id);
              }}
              variant="secondary"
            />
            <Button title={t('common.delete')} onPress={() => remove(rule)} variant="danger" />
          </Card>
        ))
      )}
      {editing !== undefined ? (
        <RecurringFormModal rule={editing ?? undefined} onClose={() => setEditing(undefined)} />
      ) : null}
    </Screen>
  );
}
