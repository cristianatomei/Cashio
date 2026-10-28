import { useRouter } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';

import { schema, useDb } from '@/core/db';
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
} from '@/core/ui';
import { addMonths, monthRange } from '@/core/utils/dates';
import { formatMinor } from '@/core/utils/money';
<<<<<<< HEAD
=======
import { useAccountBalances, useAccounts } from '@/features/accounts';
import { PlanningCards } from '@/features/planning/ui/PlanningCards';
>>>>>>> origin/master
import { useBudgetViews } from '@/features/budgets';
import {
  CaptureHealthBanner,
  NotificationBellButton,
  useCaptureHealth,
  useCaptureRefresh,
} from '@/features/capture';
import { backupSettingKeys, isBackupStale } from '@/features/backup';
import {
<<<<<<< HEAD
=======
  recurringPaymentsInRange,
  useNextMonthEstimate,
  useRecurringRules,
} from '@/features/recurring';
import { eq } from 'drizzle-orm';
import { ratePreferenceOrder } from '@/features/exchange-rates/data/rateOrder';
import {
>>>>>>> origin/master
  SummaryCard,
  TransactionRow,
  summarize,
  useTransactionViews,
} from '@/features/transactions';
import { PAYDAY_SETTING, useHomeOverview } from '@/features/home/data/useHomeOverview';
import { homeCopy } from '@/features/home/copy';
import { HomeAction } from '@/features/home/ui/HomeAction';
import { HomeSkeleton } from '@/features/home/ui/HomeSkeleton';
import { SpendingCard } from '@/features/home/ui/SpendingCard';
import { LoanLinks } from '@/features/home/ui/LoanLinks';
import { saveHomeLoanLink } from '@/features/home/data/loanLinks';

const RECENT_COUNT = 5;
const PRIORITY_COUNT = 3;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const copy = homeCopy(i18n.language);
  const router = useRouter();
  const refreshCapture = useCaptureRefresh();
  const captureHealth = useCaptureHealth();
  const db = useDb();
<<<<<<< HEAD
  const [now, setNow] = useState(() => Date.now());
=======
  const { data: exchangeRates } = useLiveQuery(
    db
      .select()
      .from(schema.exchangeRates)
      .orderBy(...ratePreferenceOrder()),
  );
  const [now] = useState(() => Date.now());
  const [backupCheckAt, setBackupCheckAt] = useState(now);
>>>>>>> origin/master
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);
  const overview = useHomeOverview(now);
  const { baseCurrency } = overview;
  const { accounts, balances, draftCount } = overview;
  const range = monthRange(now);
  const budgets = useBudgetViews(range.from);
  const { data: appSettings } = useLiveQuery(db.select().from(schema.appSettings));
  const monthViews = useTransactionViews(range);
  const previousMonthViews = useTransactionViews(monthRange(addMonths(range.from, -1)));
  const toBaseViews = (views: typeof monthViews) =>
    views.flatMap((view) => {
      const amountMinor = view.currency === baseCurrency ? view.amountMinor : view.baseAmountMinor;
      return amountMinor === null ? [] : [{ ...view, amountMinor }];
    });
  const totals = summarize(toBaseViews(monthViews));
  const previousTotals = summarize(toBaseViews(previousMonthViews));
  const unconvertedTransactionCount = monthViews.filter(
    (view) =>
      view.status === 'confirmed' &&
      view.type !== 'transfer' &&
      view.currency !== baseCurrency &&
      view.baseAmountMinor === null,
  ).length;
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const comparisonMoney = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: baseCurrency,
    signDisplay: 'always',
  });
<<<<<<< HEAD
=======
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
>>>>>>> origin/master
  const lastBackupValue = appSettings.find(
    (setting) => setting.key === backupSettingKeys.lastAt,
  )?.value;
  const lastBackupAt =
    lastBackupValue && Number.isSafeInteger(Number(lastBackupValue))
      ? Number(lastBackupValue)
      : null;
  const priorityBudgets = useMemo(
<<<<<<< HEAD
    () => [...budgets].sort((a, b) => b.progress - a.progress).slice(0, PRIORITY_COUNT),
=======
    () =>
      [...budgets].sort((left, right) => right.progress - left.progress).slice(0, UPCOMING_COUNT),
>>>>>>> origin/master
    [budgets],
  );
  const upcomingPayments = overview.obligations.slice(0, PRIORITY_COUNT);
  const refresh = async () => {
    setNow(Date.now());
    await refreshCapture();
  };

<<<<<<< HEAD
  if (overview.loading) {
    return (
      <Screen title={t('home.title')}>
        <HomeSkeleton label={copy.loading} />
      </Screen>
    );
=======
  const latestRates = new Map<string, number>();
  for (const rate of exchangeRates) {
    if (
      !latestRates.has(rate.currency) &&
      rate.effectiveAt <= now &&
      (rate.source === 'manual' || rate.source === `frankfurter:ECB:${baseCurrency}`)
    ) {
      latestRates.set(rate.currency, rate.rateToBase);
    }
>>>>>>> origin/master
  }

  return (
    <Screen title={t('home.title')} headerAction={<NotificationBellButton />} onRefresh={refresh}>
<<<<<<< HEAD
      {overview.error ? (
=======
      {isBackupStale(lastBackupAt, backupCheckAt) ? (
>>>>>>> origin/master
        <Card>
          <AppText accessibilityRole="alert">{copy.error}</AppText>
        </Card>
      ) : overview.hasAccounts ? (
        <SpendingCard
          result={overview.result}
          currency={baseCurrency}
          paydayValue={overview.paydayValue}
          now={now}
          copy={copy}
          onSave={(value) => {
            db.insert(schema.appSettings)
              .values({ key: PAYDAY_SETTING, value })
              .onConflictDoUpdate({ target: schema.appSettings.key, set: { value } })
              .run();
          }}
        >
          {overview.loans.length > 0 && overview.expenseRules.length > 0 ? (
            <LoanLinks
              loans={overview.loans}
              rules={overview.expenseRules}
              copy={copy}
              onLink={(loanId, recurringId) => saveHomeLoanLink(db, loanId, recurringId)}
            />
          ) : null}
        </SpendingCard>
      ) : (
        <Card>
          <HomeAction
            title={copy.noAccounts}
            hint={copy.noAccountsHint}
            onPress={() => router.push('/manage/accounts')}
          />
        </Card>
      )}

      <Card>
        <HomeAction
          title={draftCount > 0 ? t('home.toClassify', { count: draftCount }) : copy.classified}
          hint={draftCount > 0 ? t('home.toClassifyHint') : copy.classifiedHint}
          onPress={() => router.push('/inbox')}
        />
      </Card>

<<<<<<< HEAD
      <SectionHeader title={t('home.upcomingPayments')} />
      <Card>
        {upcomingPayments.length > 0 ? (
          upcomingPayments.map((payment) => (
            <View key={payment.key} style={styles.payment}>
              <HomeAction
                title={payment.name || t('recurring.obligation')}
                hint={`${new Date(payment.dueAt).toLocaleDateString(locale)} · ${t(payment.source === 'loan' ? 'recurring.monthlyScheduleLoan' : 'recurring.monthlyScheduleRecurring')}`}
=======
      <AppText variant="heading" style={styles.section}>
        {t('home.thisMonth')}
      </AppText>
      <SummaryCard totals={totals} currency={baseCurrency} />
      <PlanningCards />
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
>>>>>>> origin/master
                onPress={() => router.push('/recurring')}
              />
              <AmountText
                amountMinor={payment.amountMinor}
                currency={payment.currency}
                type="expense"
              />
            </View>
          ))
        ) : (
          <HomeAction
            title={copy.noPayments}
            hint={copy.noPaymentsHint}
            onPress={() => router.push('/recurring')}
          />
        )}
      </Card>

      <SectionHeader title={t('home.budgetProgress')} />
      <Card>
        {priorityBudgets.length > 0 ? (
          <>
            {priorityBudgets.map((budget) => (
              <View key={budget.id} style={styles.budget}>
                <View style={styles.budgetHeading}>
                  <AppText style={styles.budgetName}>{budget.name}</AppText>
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
            <HomeAction title={t('home.viewBudgets')} onPress={() => router.push('/budgets')} />
          </>
        ) : (
          <HomeAction
            title={copy.noBudgets}
            hint={copy.noBudgetsHint}
            onPress={() => router.push('/budgets')}
          />
        )}
      </Card>

      <CaptureHealthBanner status={captureHealth} />
      {isBackupStale(lastBackupAt, now) ? (
        <Card>
          <HomeAction
            title={t('home.backupWarning')}
            hint={t('home.backupWarningHint')}
            onPress={() => router.push('/settings')}
          />
        </Card>
      ) : null}
      {unconvertedTransactionCount > 0 ? (
        <AppText variant="caption" color="textSecondary">
          {t('home.unconvertedTransactions', { count: unconvertedTransactionCount })}
        </AppText>
      ) : null}

      <SectionHeader title={t('home.thisMonth')} />
      <SummaryCard totals={totals} currency={baseCurrency} />
      <AppText variant="caption" color="textSecondary">
        {t('home.monthComparison', {
          income: comparisonMoney.format((totals.income - previousTotals.income) / 100),
          expenses: comparisonMoney.format((totals.expense - previousTotals.expense) / 100),
        })}
      </AppText>
      <SectionHeader title={t('home.accounts')} />
      <Card>
        {accounts.length > 0 ? (
          accounts.map((account) => (
            <ListRow
              key={account.id}
              title={account.name}
              leading={<CategoryIcon name={account.icon} color={account.color} />}
              trailing={
                <AmountText
                  amountMinor={balances.get(account.id) ?? 0}
                  currency={account.currency}
                />
              }
            />
          ))
        ) : (
          <HomeAction title={copy.noAccounts} onPress={() => router.push('/manage/accounts')} />
        )}
      </Card>
      <SectionHeader title={t('home.recent')} />
      <Card>
        {monthViews.length > 0 ? (
          monthViews.slice(0, RECENT_COUNT).map((view) => (
            <View key={view.id} style={styles.transaction}>
              <TransactionRow
                view={view}
                onPress={() =>
                  router.push({ pathname: '/add-transaction', params: { id: String(view.id) } })
                }
              />
            </View>
          ))
        ) : (
          <HomeAction
            title={copy.noRecent}
            hint={copy.noRecentHint}
            onPress={() => router.push('/add-transaction')}
          />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  payment: { gap: spacing.xs, paddingBottom: spacing.sm },
  budget: { gap: spacing.xs, marginBottom: spacing.md },
  budgetHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  budgetName: { flex: 1 },
  transaction: { minHeight: 48, justifyContent: 'center' },
});
