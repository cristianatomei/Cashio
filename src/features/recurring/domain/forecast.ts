export type RecurringProjection = {
  name?: string;
  amountMinor: number;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  nextDue: number;
  endAt: number | null;
  active: boolean;
};

export type SpendingSample = {
  loanPayment?: boolean;
  recurringId?: number | null;
  amountMinor: number;
  currency: string;
  occurredAt: number;
  source: string;
  status: string;
  type: string;
};

export type CurrencyEstimate = {
  currency: string;
  obligationsMinor: number;
  variableAverageMinor: number;
  totalMinor: number;
};

export type LoanPaymentProjection = {
  scheduleId?: number;
  amountMinor: number;
  currency: string;
  dueAt: number;
  paid?: boolean;
};

export type RecurringMatchRule = RecurringProjection & {
  id: number;
  accountId: number;
  type: 'expense' | 'income';
  amountVariable: boolean;
  categoryId: number | null;
  merchantId: number | null;
};

export type RecurringMatchTransaction = {
  accountId: number;
  type: string;
  amountMinor: number;
  currency: string;
  categoryId: number | null;
  merchantId: number | null;
  occurredAt: number;
};

export function advanceRecurringDate(
  timestamp: number,
  frequency: RecurringProjection['frequency'],
  interval: number,
): number {
  const date = new Date(timestamp);
  const day = date.getDate();
  if (frequency === 'daily') date.setDate(day + interval);
  if (frequency === 'weekly') date.setDate(day + interval * 7);
  if (frequency === 'monthly') {
    date.setDate(1);
    date.setMonth(date.getMonth() + interval);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  }
  if (frequency === 'yearly') {
    date.setDate(1);
    date.setFullYear(date.getFullYear() + interval);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  }
  return date.getTime();
}

export function occurrencesInRange(rule: RecurringProjection, from: number, to: number): number {
  if (!rule.active || rule.interval < 1 || rule.amountMinor <= 0) return 0;
  let due = rule.nextDue;
  while (due < from && (!rule.endAt || due <= rule.endAt)) {
    const next = advanceRecurringDate(due, rule.frequency, rule.interval);
    if (next <= due) return 0;
    due = next;
  }

  let count = 0;
  while (due < to && (!rule.endAt || due <= rule.endAt)) {
    count += 1;
    const next = advanceRecurringDate(due, rule.frequency, rule.interval);
    if (next <= due) break;
    due = next;
  }
  return count;
}

export function findRecurringMatch(
  transaction: RecurringMatchTransaction,
  rules: RecurringMatchRule[],
): RecurringMatchRule | null {
  const gracePeriodMs = 14 * 24 * 60 * 60 * 1000;
  const matches = rules
    .filter((rule) => {
      const identityMatches =
        rule.merchantId !== null
          ? rule.merchantId === transaction.merchantId &&
            (rule.categoryId === null || rule.categoryId === transaction.categoryId)
          : rule.categoryId !== null && rule.categoryId === transaction.categoryId;
      return (
        rule.active &&
        identityMatches &&
        rule.accountId === transaction.accountId &&
        rule.type === transaction.type &&
        (rule.amountVariable || rule.amountMinor === transaction.amountMinor) &&
        rule.currency === transaction.currency &&
        Math.abs(rule.nextDue - transaction.occurredAt) <= gracePeriodMs &&
        (rule.endAt === null || transaction.occurredAt <= rule.endAt)
      );
    })
    .sort((a, b) => {
      const aSpecificity = Number(a.merchantId !== null) + Number(a.categoryId !== null);
      const bSpecificity = Number(b.merchantId !== null) + Number(b.categoryId !== null);
      return (
        bSpecificity - aSpecificity ||
        Math.abs(a.nextDue - transaction.occurredAt) - Math.abs(b.nextDue - transaction.occurredAt)
      );
    });
  const best = matches[0];
  const nextBest = matches[1];
  if (
    best &&
    nextBest &&
    Number(best.merchantId !== null) + Number(best.categoryId !== null) ===
      Number(nextBest.merchantId !== null) + Number(nextBest.categoryId !== null) &&
    Math.abs(best.nextDue - transaction.occurredAt) ===
      Math.abs(nextBest.nextDue - transaction.occurredAt)
  ) {
    return null;
  }
  return best ?? null;
}

export function nextDueAfterPayment(rule: RecurringProjection, occurredAt: number): number {
  let nextDue = rule.nextDue;
  while (nextDue <= occurredAt) {
    const next = advanceRecurringDate(nextDue, rule.frequency, rule.interval);
    if (next <= nextDue) return nextDue;
    nextDue = next;
  }
  return nextDue;
}

export function estimateNextMonth({
  rules,
  loanPayments,
  transactions,
  targetFrom,
  targetTo,
  historyFrom,
  historyTo,
}: {
  rules: RecurringProjection[];
  loanPayments: LoanPaymentProjection[];
  transactions: SpendingSample[];
  targetFrom: number;
  targetTo: number;
  historyFrom: number;
  historyTo: number;
}): CurrencyEstimate[] {
  const obligations = new Map<string, number>();
  const recurringOccurrences = rules.flatMap((rule, ruleIndex) => {
    if (
      !rule.active ||
      rule.interval < 1 ||
      rule.amountMinor <= 0 ||
      !rule.currency ||
      targetFrom >= targetTo
    ) {
      return [];
    }

    const occurrences: {
      ruleIndex: number;
      currency: string;
      amountMinor: number;
      dueAt: number;
    }[] = [];
    let dueAt = rule.nextDue;
    while (dueAt < targetFrom && (rule.endAt === null || dueAt <= rule.endAt)) {
      const nextDue = advanceRecurringDate(dueAt, rule.frequency, rule.interval);
      if (nextDue <= dueAt) return occurrences;
      dueAt = nextDue;
    }
    while (dueAt < targetTo && (rule.endAt === null || dueAt <= rule.endAt)) {
      if (dueAt >= targetFrom) {
        occurrences.push({
          ruleIndex,
          currency: rule.currency,
          amountMinor: rule.amountMinor,
          dueAt,
        });
      }
      const nextDue = advanceRecurringDate(dueAt, rule.frequency, rule.interval);
      if (nextDue <= dueAt) break;
      dueAt = nextDue;
    }
    return occurrences;
  });
  recurringOccurrences.forEach((occurrence) => {
    obligations.set(
      occurrence.currency,
      (obligations.get(occurrence.currency) ?? 0) + occurrence.amountMinor,
    );
  });
  for (const payment of loanPayments) {
    if (
      payment.paid === true ||
      payment.currency === '' ||
      !Number.isSafeInteger(payment.amountMinor) ||
      payment.amountMinor <= 0 ||
      !Number.isFinite(payment.dueAt) ||
      payment.dueAt < targetFrom ||
      payment.dueAt >= targetTo
    ) {
      continue;
    }
    obligations.set(
      payment.currency,
      (obligations.get(payment.currency) ?? 0) + payment.amountMinor,
    );
  }

  const variableTotals = new Map<string, number>();
  for (const transaction of transactions) {
    if (
      transaction.type !== 'expense' ||
      transaction.status !== 'confirmed' ||
      transaction.source === 'recurring' ||
      transaction.recurringId != null ||
      transaction.loanPayment === true ||
      transaction.occurredAt < historyFrom ||
      transaction.occurredAt >= historyTo
    ) {
      continue;
    }

    variableTotals.set(
      transaction.currency,
      (variableTotals.get(transaction.currency) ?? 0) + transaction.amountMinor,
    );
  }

  const currencies = new Set([...obligations.keys(), ...variableTotals.keys()]);
  return [...currencies].sort().map((currency) => {
    const obligationsMinor = obligations.get(currency) ?? 0;
    const variableAverageMinor = Math.round((variableTotals.get(currency) ?? 0) / 3);
    return {
      currency,
      obligationsMinor,
      variableAverageMinor,
      totalMinor: obligationsMinor + variableAverageMinor,
    };
  });
}
