import type { TransactionView } from '@/features/transactions';

export type SpendingInsight = {
  id: string;
  kind: 'subscription' | 'priceIncrease' | 'unusual';
  merchant: string;
  currency: string;
  amountMinor: number;
  baselineMinor: number;
  transactionIds: number[];
};

const monthIndex = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.getFullYear() * 12 + date.getMonth();
};

/** Compare original currencies only: a changed FX rate is not a merchant price increase. */
export function detectSpendingInsights(
  rows: readonly TransactionView[],
  now: number,
): SpendingInsight[] {
  const currentMonth = monthIndex(now);
  const groups = new Map<string, TransactionView[]>();
  for (const row of rows) {
    if (
      row.status !== 'confirmed' ||
      row.type !== 'expense' ||
      !Number.isSafeInteger(row.amountMinor) ||
      row.amountMinor <= 0 ||
      row.occurredAt > now ||
      currentMonth - monthIndex(row.occurredAt) > 3
    )
      continue;
    const name = (row.merchant?.name ?? row.merchantRaw)?.trim();
    if (!name) continue;
    const identity = row.merchant ? `id:${row.merchant.id}` : `raw:${name.toLocaleLowerCase('en')}`;
    const key = JSON.stringify([identity, row.currency]);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const insights: SpendingInsight[] = [];
  for (const [key, values] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const ordered = [...values].sort((a, b) => a.occurredAt - b.occurredAt || a.id - b.id);
    const months = Array.from({ length: 4 }, (_, index) =>
      ordered.filter((row) => monthIndex(row.occurredAt) === currentMonth - 3 + index),
    );
    const latest = months[3];
    if (latest.length === 0) continue;
    const transaction = latest[latest.length - 1];
    const merchant = (transaction.merchant?.name ?? transaction.merchantRaw)!.trim();
    const base = {
      merchant,
      currency: transaction.currency,
      amountMinor: transaction.amountMinor,
    };
    const priorThree = months.slice(0, 3);
    const stableHistory =
      priorThree.every((month) => month.length === 1) &&
      priorThree.every((month) => month[0].amountMinor === priorThree[0][0].amountMinor);

    if (
      months.slice(1).every((month) => month.length === 1) &&
      months.slice(1).every((month) => month[0].amountMinor === transaction.amountMinor) &&
      months.slice(1).every((month) => month[0].recurringId === null)
    ) {
      insights.push({
        ...base,
        id: `subscription:${key}`,
        kind: 'subscription',
        baselineMinor: transaction.amountMinor,
        transactionIds: months.slice(1).map((month) => month[0].id),
      });
    } else if (
      stableHistory &&
      latest.length === 1 &&
      transaction.amountMinor > Math.round(priorThree[0][0].amountMinor * 1.05)
    ) {
      insights.push({
        ...base,
        id: `priceIncrease:${key}`,
        kind: 'priceIncrease',
        baselineMinor: priorThree[0][0].amountMinor,
        transactionIds: [...priorThree.map((month) => month[0].id), transaction.id],
      });
    }

    const history = priorThree
      .flat()
      .map((row) => row.amountMinor)
      .sort((a, b) => a - b);
    if (priorThree.every((month) => month.length > 0) && history.length >= 3) {
      const middle = Math.floor(history.length / 2);
      const median =
        history.length % 2
          ? history[middle]
          : Math.round((history[middle - 1] + history[middle]) / 2);
      for (const row of latest) {
        if (
          row.amountMinor < median * 2 ||
          insights.some(
            (item) => item.kind === 'priceIncrease' && item.transactionIds.includes(row.id),
          )
        )
          continue;
        insights.push({
          ...base,
          amountMinor: row.amountMinor,
          id: `unusual:${row.id}`,
          kind: 'unusual',
          baselineMinor: median,
          transactionIds: [...priorThree.flat().map((item) => item.id), row.id],
        });
      }
    }
  }
  return insights;
}
