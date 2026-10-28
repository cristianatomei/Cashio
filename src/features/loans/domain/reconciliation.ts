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
  status: string;
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
const AMOUNT_TOLERANCE_RATIO = 0.01;
const MIN_AMOUNT_TOLERANCE_MINOR = 100;
const LOAN_PAYMENT_TERMS =
  /\b(?:rata|rate|credit(?:ului)?|ipotecar(?:a|e)?|rambursare|loan|mortgage)\b/;

function localDay(value: number): number {
  const date = new Date(value);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isLoanPayment(payment: LoanPaymentForReconciliation): boolean {
  const description = `${payment.merchantRaw ?? ''} ${payment.note ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro-RO');
  return LOAN_PAYMENT_TERMS.test(description);
}

function amountTolerance(expectedMinor: number): number {
  return Math.max(MIN_AMOUNT_TOLERANCE_MINOR, Math.round(expectedMinor * AMOUNT_TOLERANCE_RATIO));
}

export function reconcileLoanPayments(
  schedules: readonly LoanScheduleForReconciliation[],
  payments: readonly LoanPaymentForReconciliation[],
): LoanPaymentMatch[] {
  const candidates = schedules.flatMap((schedule) =>
    schedule.installments.flatMap((installment) => {
      const expectedMinor =
        installment.paymentMinor + (schedule.includeInsurance ? installment.insuranceMinor : 0);
      return payments.flatMap((payment) => {
        if (
          payment.type !== 'expense' ||
          payment.status !== 'confirmed' ||
          payment.currency !== schedule.currency ||
          !Number.isSafeInteger(payment.amountMinor) ||
          payment.amountMinor <= 0 ||
          !isLoanPayment(payment)
        ) {
          return [];
        }
        const daysApart =
          Math.abs(localDay(payment.occurredAt) - localDay(installment.dueAt)) / DAY_MS;
        return daysApart <= DATE_WINDOW_DAYS &&
          Math.abs(payment.amountMinor - expectedMinor) <= amountTolerance(expectedMinor)
          ? [
              {
                scheduleId: schedule.id,
                dueAt: installment.dueAt,
                payment,
                expectedMinor,
                daysApart,
              },
            ]
          : [];
      });
    }),
  );

  const paymentCounts = new Map<number, number>();
  const installmentCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = `${candidate.scheduleId}:${candidate.dueAt}`;
    paymentCounts.set(candidate.payment.id, (paymentCounts.get(candidate.payment.id) ?? 0) + 1);
    installmentCounts.set(key, (installmentCounts.get(key) ?? 0) + 1);
  }
  return candidates
    .filter(
      (candidate) =>
        paymentCounts.get(candidate.payment.id) === 1 &&
        installmentCounts.get(`${candidate.scheduleId}:${candidate.dueAt}`) === 1,
    )
    .map((candidate) => ({
      scheduleId: candidate.scheduleId,
      dueAt: candidate.dueAt,
      transactionId: candidate.payment.id,
      expectedMinor: candidate.expectedMinor,
      actualMinor: candidate.payment.amountMinor,
    }));
}
