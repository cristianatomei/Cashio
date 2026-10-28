import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { DEFAULT_CURRENCY } from '@/core/db';
import {
  AmountText,
  AppText,
  Card,
  EmptyState,
  ProgressBar,
  Screen,
  SegmentedControl,
  SectionHeader,
  spacing,
  useTheme,
} from '@/core/ui';
import { startOfDay } from '@/core/utils/dates';
import {
  calculateAnalytics,
  DonutChart,
  Sparkline,
  InsightsReports,
  drilldownParams,
  rangeForPreset,
  type StatsRangePreset,
  type StatsSegment,
} from '@/features/stats';
import { useTransactionViews } from '@/features/transactions';
import { useCaptureRefresh } from '@/features/capture';

type DateField = 'from' | 'to';

export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const refresh = useCaptureRefresh();
  const [now] = useState(() => Date.now());
  const [preset, setPreset] = useState<StatsRangePreset>('month');
  const [customRange, setCustomRange] = useState(() => rangeForPreset('month', now));
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [breakdown, setBreakdown] = useState<'groups' | 'categories'>('groups');
  const [iosPicker, setIosPicker] = useState<DateField | null>(null);
  const range = preset === 'custom' ? customRange : rangeForPreset(preset, now);
  const allTransactions = useTransactionViews();
  const transactions = useMemo(
    () =>
      allTransactions.filter((row) => row.occurredAt >= range.from && row.occurredAt < range.to),
    [allTransactions, range.from, range.to],
  );
  const currencies = [
    ...new Set([DEFAULT_CURRENCY, ...allTransactions.map((row) => row.currency)]),
  ];
  const activeCurrency = currencies.includes(currency) ? currency : currencies[0];
  const analytics = calculateAnalytics(transactions, range, activeCurrency, DEFAULT_CURRENCY);
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: activeCurrency });
  const periodOptions = [
    { value: 'month', label: t('stats.ranges.month') },
    { value: 'quarter', label: t('stats.ranges.quarter') },
    { value: 'halfYear', label: t('stats.ranges.halfYear') },
    { value: 'year', label: t('stats.ranges.year') },
    { value: 'custom', label: t('stats.ranges.custom') },
  ] satisfies { value: StatsRangePreset; label: string }[];

  const updateCustomDate = (field: DateField, timestamp: number) => {
    const selected = startOfDay(timestamp);
    const date = new Date(selected);
    const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    setCustomRange((current) => {
      if (field === 'from') {
        return { from: selected, to: Math.max(current.to, nextDay) };
      }
      return { from: Math.min(current.from, selected), to: nextDay };
    });
  };

  const openDatePicker = (field: DateField) => {
    const value = field === 'from' ? customRange.from : customRange.to - 1;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: new Date(value),
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) updateCustomDate(field, date.getTime());
        },
      });
      return;
    }
    setIosPicker(field);
  };

  const segments = breakdown === 'groups' ? analytics.groups : analytics.categories;
  const drilldown = (segment: StatsSegment) =>
    router.push({
      pathname: '/(tabs)/transactions',
      params: drilldownParams(breakdown, segment.id, range, activeCurrency, DEFAULT_CURRENCY),
    });

  return (
    <Screen title={t('stats.title')} onRefresh={refresh}>
      <SegmentedControl options={periodOptions} value={preset} onChange={setPreset} />
      {preset === 'custom' ? (
        <Card>
          <DateRangeButton
            label={t('stats.from')}
            timestamp={customRange.from}
            locale={locale}
            onPress={() => openDatePicker('from')}
          />
          <DateRangeButton
            label={t('stats.to')}
            timestamp={customRange.to - 1}
            locale={locale}
            onPress={() => openDatePicker('to')}
          />
          {Platform.OS !== 'android' && iosPicker ? (
            <DateTimePicker
              value={new Date(iosPicker === 'from' ? customRange.from : customRange.to - 1)}
              mode="date"
              onChange={(event, date) => {
                setIosPicker(null);
                if (event.type === 'set' && date) updateCustomDate(iosPicker, date.getTime());
              }}
            />
          ) : null}
        </Card>
      ) : null}

      {currencies.length > 1 ? (
        <SegmentedControl
          options={currencies.map((value) => ({ value, label: value }))}
          value={activeCurrency}
          onChange={setCurrency}
        />
      ) : null}

      {transactions.length === 0 ? (
        <EmptyState
          icon="pie-chart-outline"
          title={t('stats.emptyTitle')}
          body={t('stats.emptyBody')}
        />
      ) : (
        <>
          <Card style={styles.summary}>
            <Summary
              label={t('summary.income')}
              amount={analytics.incomeMinor}
              currency={activeCurrency}
              type="income"
              values={analytics.trend.map((bucket) => bucket.incomeMinor)}
            />
            <Summary
              label={t('summary.expenses')}
              amount={analytics.expenseMinor}
              currency={activeCurrency}
              type="expense"
              values={analytics.trend.map((bucket) => bucket.expenseMinor)}
            />
            <Summary
              label={t('summary.balance')}
              amount={analytics.balanceMinor}
              currency={activeCurrency}
              type="neutral"
              values={analytics.trend.map((bucket) => bucket.incomeMinor - bucket.expenseMinor)}
            />
          </Card>
          {activeCurrency === DEFAULT_CURRENCY && analytics.unconvertedCount > 0 ? (
            <AppText variant="caption" color="textSecondary">
              {t('stats.unconvertedTransactions', {
                count: analytics.unconvertedCount,
                currency: String(activeCurrency),
              })}
            </AppText>
          ) : null}

          <SectionHeader title={t('stats.breakdownTitle')} />
          <AppText variant="caption" color="textSecondary">
            {t('insights.drilldownHint')}
          </AppText>
          <SegmentedControl
            options={[
              { value: 'groups', label: t('stats.groups') },
              { value: 'categories', label: t('stats.categories') },
            ]}
            value={breakdown}
            onChange={setBreakdown}
          />
          <Card style={styles.chartCard}>
            {segments.length === 0 ? (
              <AppText color="textSecondary">{t('stats.noExpenses')}</AppText>
            ) : (
              <>
                <DonutChart segments={segments} onSelect={drilldown} />
                <View style={styles.legend}>
                  {segments.map((segment) => (
                    <LegendRow
                      key={segment.id}
                      segment={segment}
                      total={analytics.expenseMinor}
                      money={money}
                      onPress={() => drilldown(segment)}
                      label={
                        segment.label === 'uncategorized' ? t('stats.uncategorized') : segment.label
                      }
                    />
                  ))}
                </View>
              </>
            )}
            <InsightsReports rows={allTransactions} currency={activeCurrency} now={now} />
          </Card>

          <SectionHeader title={t('stats.trendTitle')} />
          <Card style={styles.trend}>
            <TrendChart
              buckets={analytics.trend}
              locale={locale}
              incomeLabel={t('summary.income')}
              incomeColor={colors.income}
              expenseLabel={t('summary.expenses')}
              expenseColor={colors.expense}
            />
          </Card>

          <SectionHeader title={t('stats.topMerchants')} />
          {analytics.merchants.length === 0 ? (
            <Card>
              <AppText color="textSecondary">{t('stats.noExpenses')}</AppText>
            </Card>
          ) : (
            <Card style={styles.merchantList}>
              {analytics.merchants.map((merchant) => (
                <LegendRow
                  key={merchant.id}
                  segment={merchant}
                  total={analytics.expenseMinor}
                  money={money}
                  label={
                    merchant.label === 'uncategorized' ? t('stats.uncategorized') : merchant.label
                  }
                />
              ))}
            </Card>
          )}

          <SectionHeader title={t('stats.obligationsTitle')} />
          <Card>
            <AppText variant="heading">
              {t('stats.obligationsSummary', { count: analytics.obligationCount })}
            </AppText>
            <AmountText
              amountMinor={analytics.obligationsMinor}
              currency={activeCurrency}
              type="expense"
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

function DateRangeButton({
  label,
  timestamp,
  locale,
  onPress,
}: {
  label: string;
  timestamp: number;
  locale: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={[styles.dateButton, { borderBottomColor: colors.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${new Date(timestamp).toLocaleDateString(locale)}`}
    >
      <AppText color="textSecondary">{label}</AppText>
      <AppText variant="heading" style={{ color: colors.primary }}>
        {new Date(timestamp).toLocaleDateString(locale)}
      </AppText>
    </Pressable>
  );
}

function Summary({
  label,
  amount,
  currency,
  type,
  values,
}: {
  label: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'neutral';
  values: readonly number[];
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.summaryItem}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <AmountText amountMinor={amount} currency={currency} type={type} />
      <Sparkline
        values={values}
        color={type === 'neutral' ? colors.primary : colors[type]}
        label={t('insights.sparkline', { label })}
      />
    </View>
  );
}

function LegendRow({
  segment,
  total,
  money,
  label,
  onPress,
}: {
  segment: StatsSegment;
  total: number;
  money: Intl.NumberFormat;
  label: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      style={styles.legendItem}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        onPress
          ? `${t('insights.drilldown', { label })}, ${money.format(segment.amountMinor / 100)}`
          : undefined
      }
    >
      <View style={[styles.swatch, { backgroundColor: segment.color }]} />
      <View style={styles.legendText}>
        <AppText numberOfLines={1}>{label}</AppText>
        <ProgressBar value={total > 0 ? segment.amountMinor / total : 0} color={segment.color} />
      </View>
      <AppText variant="caption" style={{ color: colors.textSecondary }}>
        {money.format(segment.amountMinor / 100)}
      </AppText>
    </Pressable>
  );
}

function TrendChart({
  buckets,
  locale,
  incomeLabel,
  incomeColor,
  expenseLabel,
  expenseColor,
}: {
  buckets: { from: number; incomeMinor: number; expenseMinor: number }[];
  locale: string;
  incomeLabel: string;
  incomeColor: string;
  expenseLabel: string;
  expenseColor: string;
}) {
  const { colors } = useTheme();
  const maxValue = Math.max(
    1,
    ...buckets.flatMap((bucket) => [bucket.incomeMinor, bucket.expenseMinor]),
  );
  return (
    <View>
      <View style={styles.buckets}>
        {buckets.map((bucket) => (
          <View key={bucket.from} style={styles.bucket}>
            <View style={styles.barPair}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(3, (bucket.incomeMinor / maxValue) * 100)}%`,
                    backgroundColor: incomeColor,
                  },
                ]}
              />
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(3, (bucket.expenseMinor / maxValue) * 100)}%`,
                    backgroundColor: expenseColor,
                  },
                ]}
              />
            </View>
            <AppText variant="caption" color="textMuted">
              {new Date(bucket.from).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.trendLegend}>
        <AppText style={{ color: incomeColor }}>● {incomeLabel}</AppText>
        <AppText style={{ color: expenseColor }}>● {expenseLabel}</AppText>
      </View>
      <View style={[styles.baseline, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summaryItem: { flexGrow: 1, flexBasis: 110, gap: spacing.xs },
  chartCard: { alignItems: 'center', gap: spacing.md },
  legend: { width: '100%', gap: spacing.sm },
  legendItem: {
    minHeight: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendText: { flex: 1, gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  trend: { height: 220, justifyContent: 'flex-end' },
  buckets: { height: 145, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  bucket: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barPair: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { flex: 1, minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  trendLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 25,
    height: StyleSheet.hairlineWidth,
  },
  dateButton: {
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  merchantList: { gap: spacing.md },
});
