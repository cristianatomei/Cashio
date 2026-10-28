import { convertToBaseMinor } from '@/core/utils/currency';
import { startOfDay } from '@/core/utils/dates';
import {
  recurringPaymentsInRange,
  type ScheduledRecurringRule,
} from '@/features/recurring/domain/schedule';
import type { LoanInstallment } from '@/features/loans/domain/ingSchedule';

type Rule = ScheduledRecurringRule & { type: 'expense' | 'income' };
type Loan = {
  id: number;
  name: string;
  currency: string;
  recurringId: number | null;
  includeInsurance: boolean;
  installments: readonly LoanInstallment[];
};
type Payment = {
  type: string;
  status: string;
  amountMinor: number;
  currency: string;
  occurredAt: number;
  recurringId: number | null;
};
export type Obligation = {
  key: string;
  name: string;
  dueAt: number;
  amountMinor: number;
  currency: string;
  source: 'recurring' | 'loan';
};

function calendarDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

/** Explicit next payday only: never infer a salary from generic recurring income. */
export function parsePayday(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date.getTime()
    : null;
}

export function daysUntilPayday(now: number, payday: number | null): number | null {
  if (payday === null || !Number.isFinite(now) || !Number.isFinite(payday)) return null;
  const days = calendarDay(payday) - calendarDay(now);
  return days > 0 && days <= 366 ? days : null;
}

/** Outstanding known payments in [today, payday), with linked loans authoritative. */
export function homeObligations(input: {
  now: number;
  to: number;
  rules: readonly Rule[];
  loans: readonly Loan[];
  payments: readonly Payment[];
}): Obligation[] {
  const from = startOfDay(input.now);
  const linkedRules = new Set(input.loans.map((loan) => loan.recurringId));
  const paid = input.payments.filter(
    (payment) => payment.status === 'confirmed' && payment.type === 'expense',
  );
  const recurring = input.rules
    .filter((rule) => rule.type === 'expense' && !linkedRules.has(rule.id))
    .flatMap((rule) =>
      recurringPaymentsInRange([rule], from, input.to).map((occurrence) => {
        const settled = paid
          .filter(
            (payment) =>
              payment.recurringId === rule.id &&
              payment.currency === rule.currency &&
              calendarDay(payment.occurredAt) === calendarDay(occurrence.dueAt),
          )
          .reduce((sum, payment) => sum + Math.max(0, payment.amountMinor), 0);
        return {
          ...occurrence,
          amountMinor: Math.max(0, occurrence.amountMinor - settled),
          source: 'recurring' as const,
        };
      }),
    );
  const loans = input.loans.flatMap((loan) =>
    loan.installments
      .filter((installment) => installment.dueAt >= from && installment.dueAt < input.to)
      .map((installment) => {
        // Text/date reconciliation is only a suggestion, not proof of settlement.
        const unambiguous =
          input.loans.filter(
            (candidate) =>
              candidate.recurringId === loan.recurringId &&
              candidate.installments.some(
                (row) => calendarDay(row.dueAt) === calendarDay(installment.dueAt),
              ),
          ).length === 1;
        const settled = paid
          .filter(
            (payment) =>
              unambiguous &&
              loan.recurringId !== null &&
              payment.recurringId === loan.recurringId &&
              payment.currency === loan.currency &&
              calendarDay(payment.occurredAt) === calendarDay(installment.dueAt),
          )
          .reduce((sum, payment) => sum + Math.max(0, payment.amountMinor), 0);
        return {
          key: `loan-${loan.id}-${installment.dueAt}`,
          name: loan.name,
          dueAt: installment.dueAt,
          currency: loan.currency,
          amountMinor: Math.max(
            0,
            installment.paymentMinor +
              (loan.includeInsurance ? installment.insuranceMinor : 0) -
              settled,
          ),
          source: 'loan' as const,
        };
      }),
  );
  return [...recurring, ...loans]
    .filter((payment) => payment.amountMinor > 0)
    .sort((a, b) => a.dueAt - b.dueAt || a.key.localeCompare(b.key));
}

export function freeToSpend(input: {
  now: number;
  payday: number | null;
  baseCurrency: string;
  balances: readonly { amountMinor: number; currency: string }[];
  obligations: readonly Obligation[];
  rates: readonly { currency: string; rateToBase: number; effectiveAt: number }[];
}) {
  const rates = new Map<string, number>();
  for (const rate of [...input.rates].sort((a, b) => b.effectiveAt - a.effectiveAt)) {
    if (rate.effectiveAt <= input.now && !rates.has(rate.currency))
      rates.set(rate.currency, rate.rateToBase);
  }
  const convert = (item: { amountMinor: number; currency: string }) =>
    convertToBaseMinor(
      item.amountMinor,
      item.currency === input.baseCurrency ? 1 : (rates.get(item.currency) ?? NaN),
    );
  const balances = input.balances.map(convert);
  const obligations = input.obligations
    .filter(
      (item) =>
        item.dueAt >= startOfDay(input.now) &&
        input.payday !== null &&
        item.dueAt < startOfDay(input.payday),
    )
    .map((item) => (item.amountMinor < 0 ? null : convert(item)));
  const balanceMinor = balances.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const reservedMinor = obligations.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const days = daysUntilPayday(input.now, input.payday);
  const complete =
    !balances.includes(null) &&
    !obligations.includes(null) &&
    Number.isSafeInteger(balanceMinor) &&
    Number.isSafeInteger(reservedMinor) &&
    Number.isSafeInteger(balanceMinor - reservedMinor);
  const availableMinor =
    complete && days !== null && balances.length > 0 ? balanceMinor - reservedMinor : null;
  return {
    balanceMinor,
    reservedMinor,
    days,
    complete,
    availableMinor,
    dailyMinor:
      availableMinor === null || days === null
        ? null
        : Math.floor(Math.max(0, availableMinor) / days),
  };
}
