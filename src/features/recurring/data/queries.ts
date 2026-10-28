import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';

import { schema, useDb } from '@/core/db';
import { addMonths, startOfMonth } from '@/core/utils/dates';
import {
  parseStoredLoanSchedule,
  projectStoredLoanPayments,
  reconcileLoanPayments,
  isLoanPayment,
} from '@/features/loans';

import { estimateNextMonth } from '../domain/forecast';

export function useRecurringRules() {
  const db = useDb();
  const { data: rules } = useLiveQuery(db.select().from(schema.recurringRules));
  const { data: accounts } = useLiveQuery(db.select().from(schema.accounts));
  const { data: categories } = useLiveQuery(db.select().from(schema.categories));
  const { data: merchants } = useLiveQuery(db.select().from(schema.merchants));
  return useMemo(
    () =>
      rules.map((rule) => ({
        ...rule,
        accountName: accounts.find((account) => account.id === rule.accountId)?.name ?? '',
        categoryName: categories.find((category) => category.id === rule.categoryId)?.name ?? null,
        merchantName: merchants.find((merchant) => merchant.id === rule.merchantId)?.name ?? null,
      })),
    [rules, accounts, categories, merchants],
  );
}

export function useNextMonthEstimate() {
  const db = useDb();
  const { data: rules } = useLiveQuery(db.select().from(schema.recurringRules));
  const { data: transactions } = useLiveQuery(db.select().from(schema.transactions));
  const { data: loanSchedules } = useLiveQuery(db.select().from(schema.loanSchedules));
  const { data: categories } = useLiveQuery(db.select().from(schema.categories));
  const { data: merchants } = useLiveQuery(db.select().from(schema.merchants));
  const [now] = useState(() => Date.now());
  const targetFrom = addMonths(startOfMonth(now), 1);
  const targetTo = addMonths(targetFrom, 1);
  const historyTo = startOfMonth(now);
  const historyFrom = addMonths(historyTo, -3);

  return useMemo(() => {
    const schedules = loanSchedules.map((schedule) => {
      const stored = parseStoredLoanSchedule(schedule.installmentsJson);
      return {
        ...schedule,
        includeInsurance: stored.includeInsurance,
        installments: stored.installments,
      };
    });
    const reconciliationTransactions = transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      occurredAt: transaction.occurredAt,
      merchantRaw: transaction.merchantRaw,
      note: transaction.note,
    }));
    const loanPaymentMatches = reconcileLoanPayments(schedules, reconciliationTransactions);
    const matchedInstallments = new Set(
      loanPaymentMatches.map((match) => `${match.scheduleId}:${match.dueAt}`),
    );
    const linkedRecurringRules = new Set(
      schedules.map((schedule) => schedule.recurringId).filter((id): id is number => id !== null),
    );

    return estimateNextMonth({
      rules: rules
        .filter((rule) => !linkedRecurringRules.has(rule.id))
        .map((rule) => ({
          name: [
            rule.note,
            categories.find((category) => category.id === rule.categoryId)?.name,
            merchants.find((merchant) => merchant.id === rule.merchantId)?.name,
          ]
            .filter(Boolean)
            .join(' '),
          amountMinor: rule.amountMinor,
          currency: rule.currency,
          frequency: rule.frequency,
          interval: rule.interval,
          nextDue: rule.nextDue,
          endAt: rule.endAt,
          active: rule.active,
        })),
      loanPayments: projectStoredLoanPayments(loanSchedules, targetFrom, targetTo).map(
        (payment) => ({
          ...payment,
          paid: matchedInstallments.has(`${payment.scheduleId}:${payment.dueAt}`),
        }),
      ),
      transactions: transactions.map((transaction) => ({
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        occurredAt: transaction.occurredAt,
        source: transaction.source,
        status: transaction.status,
        type: transaction.type,
        loanPayment: isLoanPayment({
          id: transaction.id,
          type: transaction.type,
          status: transaction.status,
          amountMinor: transaction.amountMinor,
          currency: transaction.currency,
          occurredAt: transaction.occurredAt,
          merchantRaw: transaction.merchantRaw,
          note: transaction.note,
        }),
      })),
      targetFrom,
      targetTo,
      historyFrom,
      historyTo,
    });
  }, [
    rules,
    loanSchedules,
    transactions,
    categories,
    merchants,
    targetFrom,
    targetTo,
    historyFrom,
    historyTo,
  ]);
}
