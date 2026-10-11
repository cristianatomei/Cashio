import type { TransactionView } from '@/features/transactions';

export type StatsRangePreset = 'month' | 'quarter' | 'halfYear' | 'year' | 'custom';

export type StatsRange = { from: number; to: number };

export type StatsSegment = {
  id: string;
  label: string;
  amountMinor: number;
  color: string;
};

export type StatsBucket = {
  from: number;
  incomeMinor: number;
  expenseMinor: number;
};

export type Analytics = {
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  groups: StatsSegment[];
  categories: StatsSegment[];
  merchants: StatsSegment[];
  obligationsMinor: number;
  obligationCount: number;
  unconvertedCount: number;
  trend: StatsBucket[];
};

const FALLBACK_COLOR = '#94A3B8';
const UNCATEGORIZED_COLOR = '#64748B';

export function rangeForPreset(
  preset: Exclude<StatsRangePreset, 'custom'>,
  now: number,
): StatsRange {
  const date = new Date(now);
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();

  if (preset === 'month') {
    return {
      from: monthStart,
      to: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(),
    };
  }
  if (preset === 'quarter' || preset === 'halfYear') {
    const months = preset === 'quarter' ? 3 : 6;
    return {
      from: new Date(date.getFullYear(), date.getMonth() - months + 1, 1).getTime(),
      to: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(),
    };
  }
  return {
    from: new Date(date.getFullYear(), 0, 1).getTime(),
    to: new Date(date.getFullYear() + 1, 0, 1).getTime(),
  };
}

export function calculateAnalytics(
  rows: readonly TransactionView[],
  range: StatsRange,
  currency: string,
  baseCurrency = 'RON',
): Analytics {
  let incomeMinor = 0;
  let expenseMinor = 0;
  let obligationsMinor = 0;
  let obligationCount = 0;
  let unconvertedCount = 0;
  const groupTotals = new Map<string, StatsSegment>();
  const categoryTotals = new Map<string, StatsSegment>();
  const merchantTotals = new Map<string, StatsSegment>();
  const bucketCount = 6;
  const span = Math.max(1, range.to - range.from);
  const trend: StatsBucket[] = Array.from({ length: bucketCount }, (_, index) => ({
    from: range.from + Math.floor((span * index) / bucketCount),
    incomeMinor: 0,
    expenseMinor: 0,
  }));

  for (const row of rows) {
    if (
      row.occurredAt < range.from ||
      row.occurredAt >= range.to ||
      row.status !== 'confirmed' ||
      row.type === 'transfer'
    )
      continue;
    const amountMinor =
      row.currency === currency
        ? row.amountMinor
        : currency === baseCurrency
          ? row.baseAmountMinor
          : null;
    if (amountMinor === null) {
      if (currency === baseCurrency && row.currency !== baseCurrency) unconvertedCount += 1;
      continue;
    }

    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor(((row.occurredAt - range.from) / span) * bucketCount)),
    );
    if (row.type === 'income') {
      incomeMinor += amountMinor;
      trend[bucketIndex].incomeMinor += amountMinor;
      continue;
    }

    expenseMinor += amountMinor;
    trend[bucketIndex].expenseMinor += amountMinor;
    if (row.recurringId !== null) {
      obligationsMinor += amountMinor;
      obligationCount += 1;
    }

    let allocatedMinor = 0;
    row.allocations.forEach((allocation, index) => {
      const allocationMinor =
        index === row.allocations.length - 1
          ? amountMinor - allocatedMinor
          : Math.round((amountMinor * allocation.amountMinor) / row.amountMinor);
      allocatedMinor += allocationMinor;
      const category = allocation.category;
      const groupId = category?.groupId.toString() ?? 'uncategorized';
      const group = groupTotals.get(groupId) ?? {
        id: groupId,
        label: category?.groupName || 'uncategorized',
        amountMinor: 0,
        color: category?.color ?? UNCATEGORIZED_COLOR,
      };
      group.amountMinor += allocationMinor;
      groupTotals.set(groupId, group);

      const categoryId = category?.id.toString() ?? 'uncategorized';
      const categoryTotal = categoryTotals.get(categoryId) ?? {
        id: categoryId,
        label: category?.name || 'uncategorized',
        amountMinor: 0,
        color: category?.color ?? UNCATEGORIZED_COLOR,
      };
      categoryTotal.amountMinor += allocationMinor;
      categoryTotals.set(categoryId, categoryTotal);
    });

    const category = row.category;
    const merchantLabel = row.merchant?.name ?? row.merchantRaw ?? 'uncategorized';
    const merchantTotal = merchantTotals.get(merchantLabel) ?? {
      id: merchantLabel,
      label: merchantLabel,
      amountMinor: 0,
      color: category?.color ?? FALLBACK_COLOR,
    };
    merchantTotal.amountMinor += amountMinor;
    merchantTotals.set(merchantLabel, merchantTotal);
  }

  const descending = (left: StatsSegment, right: StatsSegment) =>
    right.amountMinor - left.amountMinor || left.label.localeCompare(right.label);

  return {
    incomeMinor,
    expenseMinor,
    balanceMinor: incomeMinor - expenseMinor,
    groups: [...groupTotals.values()].sort(descending),
    categories: [...categoryTotals.values()].sort(descending),
    merchants: [...merchantTotals.values()].sort(descending).slice(0, 5),
    obligationsMinor,
    obligationCount,
    unconvertedCount,
    trend,
  };
}
