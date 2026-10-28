import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';

import { schema, useDb } from '@/core/db';
import { addMonths, startOfMonth } from '@/core/utils/dates';
import { installmentTotal, parseStoredLoanSchedule } from '@/features/loans';

import { estimateNextMonth } from '../domain/forecast';

export function useRecurringRules() {
  const db = useDb();
  const { data: rules } = useLiveQuery(db.select().from(schema.recurringRules));
  const { data: accounts } = useLiveQuery(db.select().from(schema.accounts));
  const { data: categories } = useLiveQuery(db.select().from(schema.categories));
  const { data: merchants } = useLiveQuery(db.select().from(schema.merchants));
  return useMemo(
    () => rules.map((rule) => ({
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
  const [now] = useState(() => Date.now());
  const targetFrom = addMonths(startOfMonth(now), 1);
  const targetTo = addMonths(targetFrom, 1);
  const historyTo = startOfMonth(now);
  const historyFrom = addMonths(historyTo, -3);

  return useMemo(
    () => estimateNextMonth({
      rules: rules.map((rule) => ({
        amountMinor: rule.amountMinor,
        currency: rule.currency,
        frequency: rule.frequency,
        interval: rule.interval,
        nextDue: rule.nextDue,
        endAt: rule.endAt,
        active: rule.active,
      })),
      loanPayments: loanSchedules.flatMap((schedule) => {
        const stored = parseStoredLoanSchedule(schedule.installmentsJson);
        return stored.installments.map((installment) => ({
          amountMinor: installmentTotal(installment, stored.includeInsurance),
          currency: schedule.currency,
          dueAt: installment.dueAt,
        }));
      }),
      transactions: transactions.map((transaction) => ({
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        occurredAt: transaction.occurredAt,
        source: transaction.source,
        status: transaction.status,
        type: transaction.type,
      })),
      targetFrom,
      targetTo,
      historyFrom,
      historyTo,
    }),
    [rules, loanSchedules, transactions, targetFrom, targetTo, historyFrom, historyTo],
  );
}