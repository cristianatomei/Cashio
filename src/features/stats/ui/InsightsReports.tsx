import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AmountText, AppText, Button, Card, SectionHeader, spacing } from '@/core/ui';
import { formatMinor } from '@/core/utils/money';
import type { TransactionView } from '@/features/transactions';
import { exportMonthlyReport, ReportExportError } from '../data/exportReport';
import { detectSpendingInsights } from '../domain/insights';
import {
  buildMonthlyReport,
  monthRange,
  yearComparison,
  type ReportLabels,
} from '../domain/report';

export function InsightsReports({
  rows,
  currency,
  now,
}: {
  rows: readonly TransactionView[];
  currency: string;
  now: number;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const [selectedMonth, setSelectedMonth] = useState(() => monthRange(now).from);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const insights = useMemo(() => detectSpendingInsights(rows, now), [rows, now]);
  const report = useMemo(
    () => buildMonthlyReport(rows, selectedMonth, currency),
    [rows, selectedMonth, currency],
  );
  const priorMonth = monthRange(selectedMonth, -12).from;
  const previous = useMemo(
    () => buildMonthlyReport(rows, priorMonth, currency),
    [rows, priorMonth, currency],
  );
  const monthLabel = new Date(selectedMonth).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
  const labels: ReportLabels = {
    title: t('insights.titleReport'),
    income: t('summary.income'),
    expense: t('summary.expenses'),
    balance: t('summary.balance'),
    missingRate: t('insights.missingRate'),
    excluded: t('insights.excluded'),
    date: t('insights.date'),
    type: t('insights.type'),
    merchant: t('insights.merchant'),
    category: t('insights.category'),
    originalCurrency: t('insights.originalCurrency'),
    originalAmount: t('insights.originalAmount'),
    reportAmount: t('insights.reportAmount'),
    currency: t('insights.currency'),
    privacy: t('insights.privacy'),
  };
  const exportReport = async (format: 'pdf' | 'csv') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await exportMonthlyReport(format, report, labels, locale);
    } catch (cause) {
      setError(
        cause instanceof ReportExportError && cause.reason !== 'failed'
          ? t(`insights.${cause.reason}`)
          : t('insights.exportError'),
      );
    } finally {
      setBusy(false);
    }
  };
  const changeMonth = (offset: number) => {
    setSelectedMonth(monthRange(selectedMonth, offset).from);
    setError('');
  };

  return (
    <>
      <SectionHeader title={t('insights.title')} />
      <AppText variant="caption" color="textSecondary">
        {t('insights.disclaimer')}
      </AppText>
      {insights.length === 0 ? (
        <Card>
          <AppText>{t('insights.empty')}</AppText>
        </Card>
      ) : (
        insights.map((insight) => (
          <Card key={insight.id}>
            <AppText variant="heading">
              {t(`insights.${insight.kind}`, { merchant: insight.merchant })}
            </AppText>
            <AppText>
              {t(`insights.${insight.kind}Reason`, {
                amount: formatMinor(insight.amountMinor, insight.currency, locale),
                baseline: formatMinor(insight.baselineMinor, insight.currency, locale),
              })}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t('insights.evidence', { ids: insight.transactionIds.join(', ') })}
            </AppText>
            {insight.kind === 'subscription' ? (
              <Button
                title={t('insights.review')}
                variant="secondary"
                onPress={() => router.push('/recurring')}
              />
            ) : null}
          </Card>
        ))
      )}
      <SectionHeader title={t('insights.reports')} />
      <Card>
        <AppText variant="heading">
          {monthLabel} · {currency}
        </AppText>
        <View style={styles.monthButtons}>
          <View style={styles.flex}>
            <Button
              variant="secondary"
              title={t('insights.previousMonth')}
              onPress={() => changeMonth(-1)}
              disabled={busy}
            />
          </View>
          <View style={styles.flex}>
            <Button
              variant="secondary"
              title={t('insights.nextMonth')}
              onPress={() => changeMonth(1)}
              disabled={busy || selectedMonth >= monthRange(now).from}
            />
          </View>
        </View>
        <AppText variant="caption">{t('insights.privacy')}</AppText>
        {selectedMonth === monthRange(now).from ? (
          <AppText variant="caption" color="textSecondary">
            {t('insights.partial')}
          </AppText>
        ) : null}
        <AmountText
          amountMinor={report.analytics.balanceMinor}
          currency={currency}
          type="neutral"
        />
        {report.rows.length === 0 ? <AppText>{t('insights.emptyReport')}</AppText> : null}
        <AppText variant="heading">{t('insights.comparison', { month: monthLabel })}</AppText>
        {previous.rows.length === 0 ? <AppText>{t('insights.noHistory')}</AppText> : null}
        {(['incomeMinor', 'expenseMinor', 'balanceMinor'] as const).map((field) => {
          const comparison = yearComparison(report.analytics[field], previous.analytics[field]);
          const label =
            field === 'incomeMinor'
              ? labels.income
              : field === 'expenseMinor'
                ? labels.expense
                : labels.balance;
          return (
            <AppText key={field}>
              {t('insights.change', {
                label,
                previous: formatMinor(previous.analytics[field], currency, locale),
                current: formatMinor(report.analytics[field], currency, locale),
                delta: formatMinor(comparison.deltaMinor, currency, locale),
                percent:
                  comparison.percent === null || previous.rows.length === 0
                    ? t('insights.noPercent')
                    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(comparison.percent)}%`,
              })}
            </AppText>
          );
        })}
        <AppText variant="caption" color="textSecondary">
          {t('insights.exclusions', {
            current: report.analytics.unconvertedCount,
            previous: previous.analytics.unconvertedCount,
          })}
        </AppText>
        <Button
          title={t('insights.exportPdf')}
          onPress={() => void exportReport('pdf')}
          disabled={busy}
        />
        <Button
          title={t('insights.exportCsv')}
          onPress={() => void exportReport('csv')}
          disabled={busy}
          variant="secondary"
        />
        {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  monthButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flexGrow: 1, flexBasis: 140 },
});
