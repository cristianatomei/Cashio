import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DEFAULT_CURRENCY, schema, useDb } from '@/core/db';
import {
  AmountText,
  AppText,
  Card,
  CategoryIcon,
  ListRow,
  Screen,
  spacing,
  useTheme,
} from '@/core/ui';
import { addMonths, monthRange } from '@/core/utils/dates';
import { convertToBaseMinor } from '@/core/utils/currency';
import { useAccountBalances, useAccounts } from '@/features/accounts';
import { NotificationBellButton, useCaptureRefresh } from '@/features/capture';
import { useNextMonthEstimate } from '@/features/recurring';
import { desc, eq } from 'drizzle-orm';
import {
  SummaryCard,
  TransactionRow,
  summarize,
  useDraftViews,
  useTransactionViews,
} from '@/features/transactions';

const RECENT_COUNT = 5;

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
});
