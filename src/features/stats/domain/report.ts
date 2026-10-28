import type { TransactionView } from '@/features/transactions';
import { calculateAnalytics, type StatsRange } from './analytics';

export function monthRange(timestamp: number, offset = 0): StatsRange {
  const date = new Date(timestamp);
  return {
    from: new Date(date.getFullYear(), date.getMonth() + offset, 1).getTime(),
    to: new Date(date.getFullYear(), date.getMonth() + offset + 1, 1).getTime(),
  };
}

export function yearComparison(current: number, previous: number) {
  return {
    deltaMinor: current - previous,
    percent: previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100,
  };
}

export function localDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildMonthlyReport(
  rows: readonly TransactionView[],
  timestamp: number,
  currency: string,
  baseCurrency = 'RON',
) {
  const range = monthRange(timestamp);
  const transactions = rows.filter(
    (row) =>
      row.status === 'confirmed' &&
      row.type !== 'transfer' &&
      row.occurredAt >= range.from &&
      row.occurredAt < range.to,
  );
  const analytics = calculateAnalytics(transactions, range, currency, baseCurrency);
  return {
    month: localDate(range.from).slice(0, 7),
    currency,
    analytics,
    rows: transactions
      .filter((row) => row.currency === currency || currency === baseCurrency)
      .sort((a, b) => a.occurredAt - b.occurredAt || a.id - b.id)
      .map((row) => ({
        id: row.id,
        date: localDate(row.occurredAt),
        type: row.type,
        merchant: row.merchant?.name ?? row.merchantRaw ?? '',
        category: row.allocations
          .map((item) => item.category?.name ?? '')
          .filter(Boolean)
          .join(' / '),
        originalCurrency: row.currency,
        originalMinor: row.amountMinor,
        reportMinor: row.currency === currency ? row.amountMinor : row.baseAmountMinor,
      })),
  };
}

export type MonthlyReport = ReturnType<typeof buildMonthlyReport>;
export type ReportLabels = {
  title: string;
  income: string;
  expense: string;
  balance: string;
  missingRate: string;
  excluded: string;
  date: string;
  type: string;
  merchant: string;
  category: string;
  originalCurrency: string;
  originalAmount: string;
  reportAmount: string;
  currency: string;
  privacy: string;
};

function csvCell(value: string | number) {
  const text = String(value);
  // Spreadsheet quoting alone does not prevent formula execution.
  const safe =
    typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text) && !/^-\d+(\.\d+)?$/.test(text)
      ? `'${text}`
      : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

const decimal = (minor: number) => (minor / 100).toFixed(2);
export function reportCsv(report: MonthlyReport, labels: ReportLabels): string {
  const summary = report.analytics;
  const lines: (string | number)[][] = [
    [labels.title, report.month],
    [labels.currency, report.currency],
    [labels.income, decimal(summary.incomeMinor)],
    [labels.expense, decimal(summary.expenseMinor)],
    [labels.balance, decimal(summary.balanceMinor)],
    [labels.excluded, summary.unconvertedCount],
    [labels.privacy],
    [],
    [
      labels.date,
      labels.type,
      labels.merchant,
      labels.category,
      labels.originalCurrency,
      labels.originalAmount,
      labels.reportAmount,
      labels.currency,
    ],
    ...report.rows.map((row) => [
      row.date,
      row.type === 'income' ? labels.income : labels.expense,
      row.merchant,
      row.category,
      row.originalCurrency,
      decimal(row.originalMinor),
      row.reportMinor === null ? labels.missingRate : decimal(row.reportMinor),
      report.currency,
    ]),
  ];
  return '\uFEFF' + lines.map((line) => line.map(csvCell).join(',')).join('\r\n');
}

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}

export function reportHtml(report: MonthlyReport, labels: ReportLabels, locale: string): string {
  const money = (minor: number, currency = report.currency) =>
    escapeHtml(new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100));
  const e = escapeHtml;
  return `<!doctype html><html lang="${locale === 'en-GB' ? 'en' : 'ro'}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:sans-serif;color:#17212b;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:7px;border-bottom:1px solid #ccc;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}h1{font-size:22px}</style>
</head><body><h1>${e(labels.title)} · ${report.month} · ${e(report.currency)}</h1>
<p>${e(labels.income)}: ${money(report.analytics.incomeMinor)} · ${e(labels.expense)}: ${money(report.analytics.expenseMinor)} · ${e(labels.balance)}: ${money(report.analytics.balanceMinor)}</p>
<p>${e(labels.excluded)}: ${report.analytics.unconvertedCount}. ${e(labels.privacy)}</p>
<table><thead><tr>${[labels.date, labels.type, labels.merchant, labels.category, labels.originalAmount, labels.reportAmount].map((label) => `<th>${e(label)}</th>`).join('')}</tr></thead><tbody>
${report.rows.map((row) => `<tr><td>${row.date}</td><td>${e(row.type === 'income' ? labels.income : labels.expense)}</td><td>${e(row.merchant)}</td><td>${e(row.category)}</td><td>${money(row.originalMinor, row.originalCurrency)}</td><td>${row.reportMinor === null ? e(labels.missingRate) : money(row.reportMinor)}</td></tr>`).join('')}
</tbody></table></body></html>`;
}
