import { en } from '@/core/i18n/locales/en';
import { expense } from './fixtures.test-helper';
import {
  buildMonthlyReport,
  escapeHtml,
  localDate,
  monthRange,
  reportCsv,
  reportHtml,
  yearComparison,
  type ReportLabels,
} from './report';

const labels: ReportLabels = {
  ...en.insights,
  title: en.insights.titleReport,
  income: 'Income',
  expense: 'Expense',
  balance: 'Balance',
};
const now = new Date(2026, 9, 20).getTime();

describe('monthly reports', () => {
  it('uses local calendar months with half-open bounds and stable chronological rows', () => {
    const range = monthRange(now);
    const result = buildMonthlyReport(
      [
        expense(8),
        expense(9, { id: 2, occurredAt: range.to }),
        expense(9, { id: 3 }),
        expense(9, { id: 1, occurredAt: range.from }),
      ],
      now,
      'RON',
    );
    expect(result.month).toBe('2026-10');
    expect(result.rows.map((row) => row.id)).toEqual([1, 3]);
    expect(result.analytics.expenseMinor).toBe(2000);
    expect(localDate(monthRange(now, -12).from)).toBe('2025-10-01');
  });

  it('excludes drafts and both legs of transfers, but keeps income/refunds as income', () => {
    const result = buildMonthlyReport(
      [
        expense(9),
        expense(9, { id: 2, type: 'income', amountMinor: 200 }),
        expense(9, { id: 3, type: 'transfer' }),
        expense(9, { id: 4, status: 'draft' }),
      ],
      now,
      'RON',
    );
    expect(result.rows).toHaveLength(2);
    expect(result.analytics).toMatchObject({
      expenseMinor: 1000,
      incomeMinor: 200,
      balanceMinor: -800,
    });
    expect(reportCsv(result, labels)).toContain('"Balance","-8.00"');
  });

  it('uses only saved conversions, preserving missing-rate evidence without inventing totals', () => {
    const result = buildMonthlyReport(
      [
        expense(9),
        expense(9, { id: 2, currency: 'EUR', baseAmountMinor: 5000 }),
        expense(9, { id: 3, currency: 'USD' }),
      ],
      now,
      'RON',
    );
    expect(result.analytics).toMatchObject({ expenseMinor: 6000, unconvertedCount: 1 });
    expect(result.rows.find((row) => row.id === 3)?.reportMinor).toBeNull();
    expect(reportCsv(result, labels)).toContain(labels.missingRate);
    expect(reportHtml(result, labels, 'en-GB')).toContain(labels.missingRate);
  });

  it('does not triangulate currencies or include native RON in a EUR report', () => {
    const result = buildMonthlyReport(
      [expense(9), expense(9, { id: 2, currency: 'EUR', baseAmountMinor: 5000 })],
      now,
      'EUR',
    );
    expect(result.rows).toHaveLength(1);
    expect(result.analytics.expenseMinor).toBe(1000);
    expect(result.rows[0].reportMinor).toBe(1000);
  });

  it('exports safe RFC4180 UTF-8 CSV with original currency and protects formula injection', () => {
    const report = buildMonthlyReport(
      [
        expense(9, {
          merchant: { id: 1, name: '=HYPERLINK("bad")\n, test' },
        }),
      ],
      now,
      'RON',
    );
    const csv = reportCsv(report, labels);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")\n, test"');
    expect(csv).toContain('\r\n');
    expect(csv).toContain('"10.00"');
    expect(csv).toContain('"RON"');
  });

  it('escapes all imported HTML and never includes external resources or notes', () => {
    const report = buildMonthlyReport(
      [
        expense(9, {
          merchant: { id: 1, name: '<img src="https://evil" onerror="bad">' },
          note: 'private unexported note',
        }),
      ],
      now,
      'RON',
    );
    const html = reportHtml(report, labels, 'ro-RO');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('private unexported note');
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('compares leap-year dates safely and makes zero baselines explicit', () => {
    expect(yearComparison(100, 0)).toEqual({ deltaMinor: 100, percent: null });
    expect(yearComparison(150, 100)).toEqual({ deltaMinor: 50, percent: 50 });
    expect(yearComparison(0, 100)).toEqual({ deltaMinor: -100, percent: -100 });
    expect(yearComparison(-50, -100)).toEqual({ deltaMinor: 50, percent: 50 });
    const range = monthRange(new Date(2024, 1, 29).getTime(), -12);
    expect(localDate(range.from)).toBe('2023-02-01');
    expect(localDate(range.to)).toBe('2023-03-01');
  });
});
