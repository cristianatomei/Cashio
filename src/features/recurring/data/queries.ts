import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';

import { schema, useDb } from '@/core/db';
import { addMonths, startOfMonth } from '@/core/utils/dates';
import { estimateWithLoanSchedules } from '@/features/loans/domain/forecast';

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
  const { data: links } = useLiveQuery(db.select().from(schema.loanPaymentLinks));
  const [now] = useState(() => Date.now());
  const targetFrom = addMonths(startOfMonth(now), 1);
  const targetTo = addMonths(targetFrom, 1);
  const historyTo = startOfMonth(now);
  const historyFrom = addMonths(historyTo, -3);

  return useMemo(
    () =>
      estimateWithLoanSchedules({
        rules,
        schedules: loanSchedules,
        links,
        transactions,
        now,
        targetFrom,
        targetTo,
        historyFrom,
        historyTo,
      }),
    [rules, loanSchedules, transactions, links, now, targetFrom, targetTo, historyFrom, historyTo],
  );
}
