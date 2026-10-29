import {
  estimateNextMonth,
  type RecurringProjection,
  type SpendingSample,
} from '@/features/recurring/domain/forecast';
import { parseStoredLoanSchedule, projectStoredLoanPayments } from './storedSchedule';
import type { LoanPaymentLink } from './reconciliation';
import { confirmedLoanSettlements } from './settlement';

type Schedule = {
  id: number;
  currency: string;
  recurringId: number | null;
  installmentsJson: string;
};
type Payment = SpendingSample & {
  id: number;
  recurringId: number | null;
};

/** Only explicit associations affect settlement or replace recurring obligations. */
export function estimateWithLoanSchedules(input: {
  schedules: readonly Schedule[];
  links: readonly LoanPaymentLink[];
  rules: readonly (RecurringProjection & { id: number; type: string })[];
  transactions: readonly Payment[];
  now: number;
  targetFrom: number;
  targetTo: number;
  historyFrom: number;
  historyTo: number;
}) {
  const linkedRules = new Set(input.schedules.map((schedule) => schedule.recurringId));
  const { settled, linkedTransactions } = confirmedLoanSettlements(
    input.schedules.map((schedule) => ({
      ...schedule,
      ...parseStoredLoanSchedule(schedule.installmentsJson),
    })),
    input.transactions,
    input.links,
    input.now,
  );
  return estimateNextMonth({
    ...input,
    rules: input.rules.filter((rule) => rule.type === 'expense' && !linkedRules.has(rule.id)),
    loanPayments: projectStoredLoanPayments(input.schedules, input.targetFrom, input.targetTo).map(
      (payment) => ({
        ...payment,
        amountMinor: Math.max(
          0,
          payment.amountMinor - (settled.get(`${payment.scheduleId}:${payment.dueAt}`) ?? 0),
        ),
      }),
    ),
    transactions: input.transactions.map((payment) => ({
      ...payment,
      loanPayment: linkedTransactions.has(payment.id),
    })),
  });
}
