import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { DEFAULT_CURRENCY, schema, useDb } from '@/core/db';
import { computeBalances } from '@/features/accounts/domain/balances';
import { parseStoredLoanSchedule } from '@/features/loans/domain/storedSchedule';
import { freeToSpend, homeObligations, parsePayday, daysUntilPayday } from '../domain/freeToSpend';

export const PAYDAY_SETTING = 'home_next_payday';

export function useHomeOverview(now: number) {
  const db = useDb();
  const accounts = useLiveQuery(db.select().from(schema.accounts));
  const transactions = useLiveQuery(db.select().from(schema.transactions));
  const rules = useLiveQuery(db.select().from(schema.recurringRules));
  const categories = useLiveQuery(db.select().from(schema.categories));
  const merchants = useLiveQuery(db.select().from(schema.merchants));
  const loans = useLiveQuery(db.select().from(schema.loanSchedules));
  const settings = useLiveQuery(db.select().from(schema.appSettings));
  const rates = useLiveQuery(db.select().from(schema.exchangeRates));
  const queries = [accounts, transactions, rules, categories, merchants, loans, settings, rates];
  const loading = queries.some((query) => query.updatedAt === undefined);
  const error = queries.some((query) => query.error !== undefined);
  const baseCurrency =
    settings.data.find((setting) => setting.key === 'base_currency')?.value ?? DEFAULT_CURRENCY;
  const paydayValue = settings.data.find((setting) => setting.key === PAYDAY_SETTING)?.value ?? '';
  const payday = parsePayday(paydayValue);
  const balances = computeBalances(accounts.data, transactions.data);
  const parsedSchedules = loans.data.map((loan) => {
    try {
      return { ...loan, ...parseStoredLoanSchedule(loan.installmentsJson) };
    } catch {
      return null;
    }
  });
  const invalidSchedule = parsedSchedules.includes(null);
  const schedules = parsedSchedules.filter((schedule) => schedule !== null);
  const namedRules = rules.data.map((rule) => ({
    ...rule,
    name:
      rule.note ||
      merchants.data.find((item) => item.id === rule.merchantId)?.name ||
      categories.data.find((item) => item.id === rule.categoryId)?.name ||
      `#${rule.id}`,
  }));
  const horizon = new Date(now);
  horizon.setHours(0, 0, 0, 0);
  horizon.setDate(horizon.getDate() + 30);
  const obligations = homeObligations({
    now,
    to: daysUntilPayday(now, payday) === null ? horizon.getTime() : payday!,
    rules: namedRules,
    loans: schedules,
    payments: transactions.data,
  });
  const result = freeToSpend({
    now,
    payday,
    baseCurrency,
    balances: accounts.data
      .filter((account) => !account.archived)
      .map((account) => ({
        amountMinor: balances.get(account.id) ?? 0,
        currency: account.currency,
      })),
    obligations,
    rates: rates.data,
  });
  return {
    loading: loading && !error,
    error: error || invalidSchedule,
    baseCurrency,
    paydayValue,
    obligations,
    result,
    hasAccounts: accounts.data.some((account) => !account.archived),
    accounts: accounts.data.filter((account) => !account.archived),
    balances,
    draftCount: transactions.data.filter((transaction) => transaction.status === 'draft').length,
    loans: loans.data,
    expenseRules: namedRules.filter((rule) => rule.type === 'expense'),
  };
}
