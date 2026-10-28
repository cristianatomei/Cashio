import { convertToBaseMinor } from '@/core/utils/currency';
import { computeBalances } from '@/features/accounts/domain/balances';
import type { InvestmentAsset } from '@/features/investments/domain/assets';
import { parseStoredLoanSchedule } from '@/features/loans/domain/storedSchedule';

import type { ValuationInput } from './goals';

type Account = {
  id: number;
  name: string;
  currency: string;
  openingBalanceMinor: number;
};
type Transaction = Parameters<typeof computeBalances>[1][number] & {
  currency: string;
  occurredAt: number;
};
type Rate = { currency: string; rateToBase: number; effectiveAt: number };
type Loan = { id: number; name: string; currency: string; installmentsJson: string };
export type MissingReason =
  'missingRate' | 'missingValuation' | 'unknownPrincipal' | 'invalidAmount' | 'unknownBalance';
export type WorthRow = {
  key: string;
  name: string;
  currency: string;
  amountMinor: number | null;
  baseMinor: number | null;
  at: number;
  rateAt?: number;
  reason?: MissingReason;
};
export type WorthSection = {
  rows: WorthRow[];
  knownMinor: number | null;
  status: 'complete' | 'partial' | 'unknown';
};

/** ING's balance is AFTER the instalment, never the payment including interest/insurance. */
export function scheduledPrincipal(installmentsJson: string, asOf: number): number | null {
  try {
    const { installments } = parseStoredLoanSchedule(installmentsJson);
    if (!installments.length) return null;
    const start = new Date(asOf);
    start.setHours(0, 0, 0, 0);
    const next = installments.findIndex((row) => row.dueAt >= start.getTime());
    const previous = next === -1 ? installments.at(-1) : installments[next - 1];
    const upcoming = next === -1 ? undefined : installments[next];
    const afterPrevious = previous?.balanceMinor;
    const beforeUpcoming =
      upcoming?.balanceMinor == null ? null : upcoming.balanceMinor + upcoming.principalMinor;
    if (afterPrevious != null && beforeUpcoming != null && afterPrevious !== beforeUpcoming) {
      return null;
    }
    const amount = afterPrevious ?? beforeUpcoming;
    return amount != null && Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
  } catch {
    return null;
  }
}

function convert(row: WorthRow, baseCurrency: string, rates: readonly Rate[]): WorthRow {
  if (row.amountMinor === null) return row;
  if (!Number.isSafeInteger(row.amountMinor)) {
    return { ...row, baseMinor: null, reason: 'invalidAmount' };
  }
  if (row.currency === baseCurrency) return { ...row, baseMinor: row.amountMinor };
  const rate = rates
    .filter(
      (rate) =>
        rate.currency === row.currency &&
        Number.isSafeInteger(rate.effectiveAt) &&
        rate.effectiveAt <= row.at &&
        Number.isFinite(rate.rateToBase) &&
        rate.rateToBase > 0,
    )
    .sort((a, b) => b.effectiveAt - a.effectiveAt)[0];
  if (!rate) return { ...row, reason: 'missingRate' };
  const baseMinor = convertToBaseMinor(row.amountMinor, rate.rateToBase);
  return {
    ...row,
    baseMinor,
    rateAt: rate.effectiveAt,
    ...(baseMinor === null ? { reason: 'invalidAmount' as const } : {}),
  };
}

function summarize(rows: WorthRow[]): WorthSection {
  const known = rows.filter((row) => row.baseMinor !== null);
  const sum = known.reduce((total, row) => total + row.baseMinor!, 0);
  if (!Number.isSafeInteger(sum)) return { rows, knownMinor: null, status: 'unknown' };
  return {
    rows,
    knownMinor: rows.length && !known.length ? null : sum,
    status: known.length === rows.length ? 'complete' : known.length ? 'partial' : 'unknown',
  };
}

export function calculateNetWorth(input: {
  baseCurrency: string;
  asOf: number;
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  assets: readonly InvestmentAsset[];
  valuations: readonly ValuationInput[];
  loans: readonly Loan[];
  rates: readonly Rate[];
  investmentsInvalid?: boolean;
}) {
  const { baseCurrency, asOf, accounts, assets, valuations, loans, rates } = input;
  const transactions = input.transactions.filter((tx) => tx.occurredAt <= asOf);
  const balances = computeBalances(accounts, transactions);
  const accountCurrencies = new Map(accounts.map((account) => [account.id, account.currency]));
  const uncertainAccounts = new Set<number>();
  for (const tx of transactions) {
    if (tx.status !== 'confirmed') continue;
    if (tx.accountId !== null && accountCurrencies.get(tx.accountId) !== tx.currency) {
      uncertainAccounts.add(tx.accountId);
    }
    if (
      tx.type === 'transfer' &&
      tx.transferAccountId !== null &&
      tx.transferAmountMinor === null &&
      accountCurrencies.get(tx.transferAccountId) !== tx.currency
    ) {
      uncertainAccounts.add(tx.transferAccountId);
    }
  }
  const accountRows = accounts.map((account): WorthRow => {
    const unknown = uncertainAccounts.has(account.id);
    return convert(
      {
        key: `account-${account.id}`,
        name: account.name,
        currency: account.currency,
        amountMinor: unknown ? null : balances.get(account.id)!,
        baseMinor: null,
        at: asOf,
        ...(unknown ? { reason: 'unknownBalance' as const } : {}),
      },
      baseCurrency,
      rates,
    );
  });
  const investmentRows = assets.map((asset): WorthRow => {
    const valuation = valuations.find((value) => value.assetId === asset.id);
    const available = valuation && valuation.valuedAt <= asOf;
    return convert(
      {
        key: `investment-${asset.id}`,
        name: asset.name,
        currency: valuation?.currency ?? baseCurrency,
        amountMinor: available ? valuation.amountMinor : null,
        baseMinor: null,
        at: available ? valuation.valuedAt : asOf,
        ...(!available ? { reason: 'missingValuation' as const } : {}),
      },
      baseCurrency,
      rates,
    );
  });
  if (input.investmentsInvalid) {
    investmentRows.push({
      key: 'invalid-investments',
      name: '',
      currency: baseCurrency,
      amountMinor: null,
      baseMinor: null,
      at: asOf,
      reason: 'missingValuation',
    });
  }
  const loanRows = loans.map((loan): WorthRow => {
    const principal = scheduledPrincipal(loan.installmentsJson, asOf);
    return convert(
      {
        key: `loan-${loan.id}`,
        name: loan.name,
        currency: loan.currency,
        amountMinor: principal,
        baseMinor: null,
        at: asOf,
        ...(principal === null ? { reason: 'unknownPrincipal' as const } : {}),
      },
      baseCurrency,
      rates,
    );
  });
  const sections = {
    accounts: summarize(accountRows),
    investments: summarize(investmentRows),
    loans: summarize(loanRows),
  };
  const values = Object.values(sections);
  const rows = [...accountRows, ...investmentRows, ...loanRows];
  const unknownCount = rows.filter((row) => row.baseMinor === null).length;
  const sum =
    (sections.accounts.knownMinor ?? 0) +
    (sections.investments.knownMinor ?? 0) -
    (sections.loans.knownMinor ?? 0);
  const knownCount = rows.length - unknownCount;
  const safe =
    Number.isSafeInteger(sum) &&
    values.every(
      (section) =>
        section.knownMinor !== null || !section.rows.some((row) => row.baseMinor !== null),
    );
  return {
    ...sections,
    baseCurrency,
    asOf,
    unknownCount,
    netMinor: safe && (!rows.length || knownCount > 0) ? sum : null,
    status:
      !safe || (unknownCount > 0 && !knownCount)
        ? ('unknown' as const)
        : unknownCount > 0
          ? ('partial' as const)
          : ('complete' as const),
  };
}
