import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { DEFAULT_CURRENCY, schema, useDb } from '@/core/db';
import { parseInvestmentAssets } from '@/features/investments/domain/assets';
import { INVESTMENT_ASSETS_SETTING } from '@/features/investments/data/assetsRepo';
import { calculateNetWorth } from '../domain/netWorth';

export function useGoals() {
  const db = useDb();
  return useLiveQuery(db.select().from(schema.savingsGoals).orderBy(asc(schema.savingsGoals.id)));
}

export function usePlanningCurrency() {
  const db = useDb();
  const { data } = useLiveQuery(
    db.select().from(schema.appSettings).where(eq(schema.appSettings.key, 'base_currency')),
  );
  return data[0]?.value ?? DEFAULT_CURRENCY;
}

export function useNetWorth(asOf: number) {
  const db = useDb();
  const {
    data: accounts,
    updatedAt: accountsAt,
    error: accountsError,
  } = useLiveQuery(db.select().from(schema.accounts));
  const {
    data: transactions,
    updatedAt: transactionsAt,
    error: transactionsError,
  } = useLiveQuery(
    db
      .select({
        accountId: schema.transactions.accountId,
        type: schema.transactions.type,
        status: schema.transactions.status,
        amountMinor: schema.transactions.amountMinor,
        currency: schema.transactions.currency,
        transferAccountId: schema.transactions.transferAccountId,
        transferAmountMinor: schema.transactions.transferAmountMinor,
        occurredAt: schema.transactions.occurredAt,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, 'confirmed')),
  );
  const {
    data: settings,
    updatedAt: settingsAt,
    error: settingsError,
  } = useLiveQuery(db.select().from(schema.appSettings));
  const {
    data: valuations,
    updatedAt: valuationsAt,
    error: valuationsError,
  } = useLiveQuery(db.select().from(schema.investmentValuations));
  const {
    data: loans,
    updatedAt: loansAt,
    error: loansError,
  } = useLiveQuery(db.select().from(schema.loanSchedules));
  const {
    data: rates,
    updatedAt: ratesAt,
    error: ratesError,
  } = useLiveQuery(db.select().from(schema.exchangeRates));
  const assetState = useMemo(() => {
    try {
      return {
        assets: parseInvestmentAssets(
          settings.find((row) => row.key === INVESTMENT_ASSETS_SETTING)?.value,
        ),
        invalid: false,
      };
    } catch {
      return { assets: [], invalid: true };
    }
  }, [settings]);
  const baseCurrency =
    settings.find((row) => row.key === 'base_currency')?.value ?? DEFAULT_CURRENCY;
  const result = useMemo(
    () =>
      calculateNetWorth({
        baseCurrency,
        asOf,
        accounts,
        transactions,
        assets: assetState.assets,
        valuations,
        loans,
        rates,
        investmentsInvalid: assetState.invalid,
      }),
    [baseCurrency, asOf, accounts, transactions, assetState, valuations, loans, rates],
  );
  return {
    ...result,
    assets: assetState.assets,
    valuations,
    loading: ![accountsAt, transactionsAt, settingsAt, valuationsAt, loansAt, ratesAt].every(
      Boolean,
    ),
    error:
      accountsError ||
      transactionsError ||
      settingsError ||
      valuationsError ||
      loansError ||
      ratesError,
  };
}
