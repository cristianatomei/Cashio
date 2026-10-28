import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';

import { DEFAULT_CURRENCY, schema, useDb } from '@/core/db';
import {
  AmountText,
  AppText,
  Card,
  CategoryIcon,
  ListRow,
  ProgressBar,
  Screen,
  SectionHeader,
  spacing,
  useTheme,
} from '@/core/ui';
import { addMonths, monthRange, startOfDay } from '@/core/utils/dates';
import { convertToBaseMinor } from '@/core/utils/currency';
import { formatMinor } from '@/core/utils/money';
import { useAccountBalances, useAccounts } from '@/features/accounts';
import { useBudgetViews } from '@/features/budgets';
import { NotificationBellButton, useCaptureRefresh } from '@/features/capture';
import { installmentTotal, parseStoredLoanSchedule } from '@/features/loans';
import { backupSettingKeys, isBackupStale } from '@/features/backup';
import {
  recurringPaymentsInRange,
  useNextMonthEstimate,
  useRecurringRules,
} from '@/features/recurring';
import { desc, eq } from 'drizzle-orm';
import {
  SummaryCard,
  TransactionRow,
  summarize,
  useDraftViews,
  useTransactionViews,
} from '@/features/transactions';

const RECENT_COUNT = 5;
const UPCOMING_COUNT = 3;
const UPCOMING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const refresh = useCaptureRefresh();
  const { colors } = useTheme();
  const db = useDb();
  const { data: exchangeRates } = useLiveQuery(
    db.select().from(schema.exchangeRates).orderBy(desc(schema.exchangeRates.effectiveAt)),
  );
  const [now] = useState(() => Date.now());
  const [backupCheckAt, setBackupCheckAt] = useState(now);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setBackupCheckAt(Date.now());
    });
    return () => subscription.remove();
  }, []);
  const baseCurrency =
    db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'base_currency'))
      .get()?.value ?? DEFAULT_CURRENCY;
  const drafts = useDraftViews();
  const accounts = useAccounts();
  const balances = useAccountBalances();
  const forecast = useNextMonthEstimate();
  const recurringRules = useRecurringRules();
  const budgets = useBudgetViews(monthRange(now).from);
  const { data: loanSchedules } = useLiveQuery(db.select().from(schema.loanSchedules));
  const { data: appSettings } = useLiveQuery(db.select().from(schema.appSettings));
  const [range] = useState(() => monthRange(now));
  const monthViews = useTransactionViews(range);
  const previousMonthViews = useTransactionViews(monthRange(addMonths(range.from, -1)));
  const toBaseAmount = (view: (typeof monthViews)[number]) =>
    view.currency === baseCurrency ? view.amountMinor : view.baseAmountMinor;
  const toBaseViews = (views: typeof monthViews) =>
    views.flatMap((view) => {
      const amountMinor = toBaseAmount(view);
      return amountMinor === null ? [] : [{ ...view, amountMinor }];
    });
  const baseMonthViews = toBaseViews(monthViews);
  const basePreviousMonthViews = toBaseViews(previousMonthViews);
  const unconvertedTransactionCount = monthViews.filter(
    (view) =>
      view.status === 'confirmed' &&
      view.type !== 'transfer' &&
      view.currency !== baseCurrency &&
      view.baseAmountMinor === null,
  ).length;
  const totals = useMemo(() => summarize(baseMonthViews), [baseMonthViews]);
  const previousTotals = useMemo(() => summarize(basePreviousMonthViews), [basePreviousMonthViews]);
  const comparisonMoney = new Intl.NumberFormat(i18n.language === 'en' ? 'en-GB' : 'ro-RO', {
    style: 'currency',
    currency: baseCurrency,
    signDisplay: 'always',
  });
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const upcomingPayments = useMemo(() => {
    const from = startOfDay(now);
    const to = from + UPCOMING_DAYS * DAY_MS;
    const recurring = recurringPaymentsInRange(
      recurringRules.map((rule) => ({
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
      from,
      to,
    ).map((payment) => ({ ...payment, source: 'recurring' as const }));
    const loans = loanSchedules.flatMap((schedule) => {
      const stored = parseStoredLoanSchedule(schedule.installmentsJson);
      return stored.installments
        .filter((installment) => installment.dueAt >= from && installment.dueAt < to)
        .map((installment) => ({
          key: `loan-${schedule.id}-${installment.dueAt}`,
          name: schedule.name,
          dueAt: installment.dueAt,
          amountMinor: installmentTotal(installment, stored.includeInsurance),
          currency: schedule.currency,
          source: 'loan' as const,
        }));
    });
    return [...recurring, ...loans]
      .sort((left, right) => left.dueAt - right.dueAt || left.key.localeCompare(right.key))
      .slice(0, UPCOMING_COUNT);
  }, [loanSchedules, now, recurringRules, t]);
  const lastBackupValue = appSettings.find((setting) => setting.key === backupSettingKeys.lastAt)
    ?.value;
  const lastBackupAt =
    lastBackupValue && Number.isSafeInteger(Number(lastBackupValue))
      ? Number(lastBackupValue)
      : null;
  const priorityBudgets = useMemo(
    () =>
      [...budgets]
        .sort((left, right) => right.progress - left.progress)
        .slice(0, UPCOMING_COUNT),
    [budgets],
  );

  const latestRates = new Map<string, number>();
  for (const rate of exchangeRates) {
    if (!latestRates.has(rate.currency) && rate.effectiveAt <= now) {
      latestRates.set(rate.currency, rate.rateToBase);
    }
  }
  const { total, unconvertedAccountCount } = accounts.reduce(
    (result, account) => {
      const amount = balances.get(account.id) ?? 0;
      if (account.currency === baseCurrency) {
        return { ...result, total: result.total + amount };
      }
      const rate = latestRates.get(account.currency);
      const converted = rate === undefined ? null : convertToBaseMinor(amount, rate);
      if (converted === null) {
        return { ...result, unconvertedAccountCount: result.unconvertedAccountCount + 1 };
      }
      return { ...result, total: result.total + converted };
    },
    { total: 0, unconvertedAccountCount: 0 },
  );

  return (
    <Screen
      title={t('home.title')}
      headerAction={<NotificationBellButton />}
      onRefresh={refresh}
    >
      {isBackupStale(lastBackupAt, backupCheckAt) ? (
        <Card>
          <ListRow
            title={t('home.backupWarning')}
            subtitle={t('home.backupWarningHint')}
            leading={<Ionicons name="cloud-offline-outline" size={28} color={colors.warning} />}
            trailing={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
            onPress={() => router.push('/settings')}
          />
        </Card>
      ) : null}
      {drafts.length > 0 ? (
        <Card>
          <ListRow
            title={t('home.toClassify', { count: drafts.length })}
            subtitle={t('home.toClassifyHint')}
            leading={<Ionicons name="alert-circle-outline" size={28} color={colors.warning} />}
            trailing={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
            onPress={() => router.push('/inbox')}
          />
        </Card>
      ) : null}
      <Card>
        <AppText variant="caption" color="textSecondary">
          {t('home.totalBalance')}
        </AppText>
        <View style={styles.total}>
          <AmountText amountMinor={total} currency={baseCurrency} variant="display" />
        </View>
      </Card>
      {unconvertedAccountCount > 0 ? (
        <AppText variant="caption" color="textSecondary">
          {t('home.unconvertedAccounts', { count: unconvertedAccountCount })}
        </AppText>
      ) : null}
      {unconvertedTransactionCount > 0 ? (
        <AppText variant="caption" color="textSecondary">
          {t('home.unconvertedTransactions', { count: unconvertedTransactionCount })}
        </AppText>
      ) : null}

      <AppText variant="heading" style={styles.section}>
        {t('home.thisMonth')}
      </AppText>
      <SummaryCard totals={totals} currency={baseCurrency} />
      <AppText variant="caption" color="textSecondary">
        {t('home.monthComparison', {
          income: comparisonMoney.format((totals.income - previousTotals.income) / 100),
          expenses: comparisonMoney.format((totals.expense - previousTotals.expense) / 100),
        })}
      </AppText>

      {forecast.length > 0 ? (
        <>
          <AppText variant="heading" style={styles.section}>
            {t('recurring.forecast')}
          </AppText>
          <Card>
            {forecast.map((item) => (
              <ListRow
                key={item.currency}
                title={t('recurring.forecastTotal')}
                leading={<Ionicons name="calendar-outline" size={24} color={colors.primary} />}
                trailing={
                  <AmountText
                    amountMinor={item.totalMinor}
                    currency={item.currency}
                    type="expense"
                  />
                }
                onPress={() => router.push('/recurring')}
              />
            ))}
            {loanSchedules.length > 0 ? (
              <AppText color="textSecondary">{t('recurring.forecastLoanWarning')}</AppText>
            ) : null}
          </Card>
        </>
      ) : null}

      {upcomingPayments.length > 0 ? (
        <>
          <SectionHeader title={t('home.upcomingPayments')} />
          <Card>
            {upcomingPayments.map((payment) => (
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
                    name={payment.source === 'loan' ? 'document-text-outline' : 'calendar-outline'}
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
                onPress={() => router.push('/recurring')}
              />
            ))}
          </Card>
        </>
      ) : null}

      {priorityBudgets.length > 0 ? (
        <>
          <SectionHeader title={t('home.budgetProgress')} />
          <Card>
            {priorityBudgets.map((budget) => (
              <View key={budget.id} style={styles.budget}>
                <View style={styles.budgetHeading}>
                  <AppText variant="body" style={styles.budgetName}>
                    {budget.name}
                  </AppText>
                  <AmountText
                    amountMinor={budget.spentMinor}
                    currency={budget.currency}
                    type="expense"
                  />
                </View>
                <ProgressBar value={budget.progress} />
                <AppText variant="caption" color="textSecondary">
                  {t('budgets.limit', {
                    amount: formatMinor(budget.limitMinor, budget.currency, locale),
                  })}
                </AppText>
              </View>
            ))}
            <ListRow
              title={t('home.viewBudgets')}
              trailing={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
              onPress={() => router.push('/budgets')}
            />
          </Card>
        </>
      ) : null}

      <AppText variant="heading" style={styles.section}>
        {t('home.accounts')}
      </AppText>
      <Card>
        {accounts.map((account) => (
          <ListRow
            key={account.id}
            title={account.name}
            leading={<CategoryIcon name={account.icon} color={account.color} />}
            trailing={
              <AmountText amountMinor={balances.get(account.id) ?? 0} currency={account.currency} />
            }
          />
        ))}
      </Card>

      {monthViews.length > 0 ? (
        <>
          <AppText variant="heading" style={styles.section}>
            {t('home.recent')}
          </AppText>
          <Card>
            {monthViews.slice(0, RECENT_COUNT).map((view) => (
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { paddingVertical: spacing.sm },
  section: { marginTop: spacing.sm },
  budget: { gap: spacing.xs, marginBottom: spacing.md },
  budgetHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  budgetName: { flex: 1 },
});
