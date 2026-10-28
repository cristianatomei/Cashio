import type { LoanInstallment } from './ingSchedule';

export type StoredLoanSchedule = {
  includeInsurance: boolean;
  remindersEnabled: boolean;
  installments: LoanInstallment[];
};

export type LoanPaymentProjection = {
  scheduleId: number;
  dueAt: number;
  amountMinor: number;
  currency: string;
};

export function projectStoredLoanPayments(
  schedules: readonly { id: number; currency: string; installmentsJson: string }[],
  from: number,
  to: number,
): LoanPaymentProjection[] {
  if (from >= to) return [];

  return schedules.flatMap((schedule) => {
    const stored = parseStoredLoanSchedule(schedule.installmentsJson);
    return stored.installments
      .filter((installment) => installment.dueAt >= from && installment.dueAt < to)
      .map((installment) => ({
        scheduleId: schedule.id,
        dueAt: installment.dueAt,
        amountMinor:
          installment.paymentMinor + (stored.includeInsurance ? installment.insuranceMinor : 0),
        currency: schedule.currency,
      }));
  });
}

export function parseStoredLoanSchedule(value: string): StoredLoanSchedule {
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('includeInsurance' in parsed) ||
    typeof parsed.includeInsurance !== 'boolean' ||
    !('remindersEnabled' in parsed) ||
    typeof parsed.remindersEnabled !== 'boolean' ||
    !('installments' in parsed) ||
    !Array.isArray(parsed.installments) ||
    !parsed.installments.every(
      (row) =>
        typeof row === 'object' &&
        row !== null &&
        'dueAt' in row &&
        Number.isSafeInteger(row.dueAt) &&
        'paymentMinor' in row &&
        Number.isSafeInteger(row.paymentMinor) &&
        row.paymentMinor > 0 &&
        'interestMinor' in row &&
        Number.isSafeInteger(row.interestMinor) &&
        row.interestMinor >= 0 &&
        'principalMinor' in row &&
        Number.isSafeInteger(row.principalMinor) &&
        row.principalMinor >= 0 &&
        'balanceMinor' in row &&
        (row.balanceMinor === null ||
          (Number.isSafeInteger(row.balanceMinor) && row.balanceMinor >= 0)) &&
        'insuranceMinor' in row &&
        Number.isSafeInteger(row.insuranceMinor) &&
        row.insuranceMinor >= 0,
    )
  ) {
    throw new Error('Stored loan schedule data is invalid.');
  }

  const schedule = parsed as StoredLoanSchedule;
  if (
    schedule.installments.some(
      (installment, index) =>
        index > 0 && schedule.installments[index - 1].dueAt >= installment.dueAt,
    )
  ) {
    throw new Error('Stored loan schedule instalments are not in due-date order.');
  }
  return schedule;
}

export function updateStoredLoanScheduleSettings(
  value: string,
  settings: Pick<StoredLoanSchedule, 'includeInsurance'>,
): string {
  const stored = parseStoredLoanSchedule(value);
  return JSON.stringify({ ...stored, includeInsurance: settings.includeInsurance });
}
