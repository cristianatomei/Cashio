import type { LoanInstallment } from './ingSchedule';

export type LoanScheduleForReconciliation = {
  id: number;
  currency: string;
  includeInsurance: boolean;
  installments: readonly LoanInstallment[];
};

export type LoanPaymentForReconciliation = {
  id: number;
  type: string;
  amountMinor: number;
  currency: string;
  occurredAt: number;
  merchantRaw: string | null;
  note: string | null;
};

export type LoanPaymentMatch = {
  scheduleId: number;
  dueAt: number;
  transactionId: number;
  expectedMinor: number;
  actualMinor: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_WINDOW_DAYS = 5;
const LOAN_PAYMENT_TERMS =
  /\b(?:rata|rate|credit(?:ului)?|ipotecar(?:a|e)?|rambursare|loan|mortgage)\b/;

function localDay(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isLoanPayment(payment: LoanPaymentForReconciliation): boolean {
  const description = `${payment.merchantRaw ?? ''} ${payment.note ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro-RO');
  return LOAN_PAYMENT_TERMS.test(description);
}

export function reconcileLoanPayments(
  schedules: readonly LoanScheduleForReconciliation[],
  payments: readonly LoanPaymentForReconciliation[],
): LoanPaymentMatch[] {
  const candidates = schedules.flatMap((schedule) =>
    schedule.installments.flatMap((installment) => {
      const expectedMinor =
        installment.paymentMinor +
        (schedule.includeInsurance ? installment.insuranceMinor : 0);
      return payments.flatMap((payment) => {
        if (
          payment.type !== 'expense' ||
          payment.currency !== schedule.currency ||
          !isLoanPayment(payment)
        ) {
          return [];
        }
        const daysApart = Math.abs(localDay(payment.occurredAt) - localDay(installment.dueAt)) / DAY_MS;
        return daysApart <= DATE_WINDOW_DAYS
          ? [{ scheduleId: schedule.id, dueAt: installment.dueAt, payment, expectedMinor, daysApart }]
          : [];
      });
    }),
  );

  candidates.sort(
    (left, right) =>
      left.daysApart - right.daysApart ||
      left.dueAt - right.dueAt ||
      left.scheduleId - right.scheduleId,
  );

  const usedTransactions = new Set<number>();
  const usedInstallments = new Set<string>();
  const matches: LoanPaymentMatch[] = [];
  for (const candidate of candidates) {
    const installmentKey = `${candidate.scheduleId}:${candidate.dueAt}`;
    if (
      usedTransactions.has(candidate.payment.id) ||
      usedInstallments.has(installmentKey)
    ) {
      continue;
    }
    usedTransactions.add(candidate.payment.id);
    usedInstallments.add(installmentKey);
    matches.push({
      scheduleId: candidate.scheduleId,
      dueAt: candidate.dueAt,
      transactionId: candidate.payment.id,
      expectedMinor: candidate.expectedMinor,
      actualMinor: candidate.payment.amountMinor,
    });
  }
  return matches;
}
