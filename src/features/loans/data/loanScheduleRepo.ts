import type { AppDb } from '@/core/db';
import * as schema from '@/core/db/schema';
import { eq } from 'drizzle-orm';

import type { LoanInstallment } from '../domain/ingSchedule';
import {
  parseStoredLoanSchedule,
  updateStoredLoanScheduleSettings,
} from '../domain/storedSchedule';

export {
  parseStoredLoanSchedule,
  projectStoredLoanPayments,
  updateStoredLoanScheduleSettings,
  type StoredLoanSchedule,
  type LoanPaymentProjection,
} from '../domain/storedSchedule';

export type LoanScheduleInput = {
  name: string;
  currency: string;
  installments: readonly LoanInstallment[];
  includeInsurance: boolean;
  remindersEnabled: boolean;
};

export type LoanScheduleSettingsInput = {
  name: string;
  includeInsurance: boolean;
};

export function saveLoanSchedule(db: AppDb, input: LoanScheduleInput): number {
  const name = input.name.trim();
  if (!name) throw new Error('A schedule name is required.');
  if (input.installments.length === 0) throw new Error('The schedule has no instalments.');
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('The schedule currency is invalid.');
  if (
    input.installments.some(
      (item, index) =>
        !Number.isSafeInteger(item.dueAt) ||
        !Number.isSafeInteger(item.paymentMinor) ||
        item.paymentMinor <= 0 ||
        !Number.isSafeInteger(item.interestMinor) ||
        item.interestMinor < 0 ||
        !Number.isSafeInteger(item.principalMinor) ||
        item.principalMinor < 0 ||
        (item.balanceMinor !== null &&
          (!Number.isSafeInteger(item.balanceMinor) || item.balanceMinor < 0)) ||
        !Number.isSafeInteger(item.insuranceMinor) ||
        item.insuranceMinor < 0 ||
        (index > 0 && input.installments[index - 1].dueAt >= item.dueAt),
    )
  ) {
    throw new Error('The schedule contains invalid instalments.');
  }

  return db
    .insert(schema.loanSchedules)
    .values({
      name,
      currency: input.currency,
      installmentsJson: JSON.stringify({
        includeInsurance: input.includeInsurance,
        remindersEnabled: input.remindersEnabled,
        installments: input.installments,
      }),
      recurringId: null,
      createdAt: Date.now(),
    })
    .returning({ id: schema.loanSchedules.id })
    .get().id;
}

export function setLoanScheduleReminders(db: AppDb, scheduleId: number, enabled: boolean): void {
  const schedule = db
    .select()
    .from(schema.loanSchedules)
    .where(eq(schema.loanSchedules.id, scheduleId))
    .get();
  if (!schedule) throw new Error('The repayment schedule does not exist.');

  const stored = parseStoredLoanSchedule(schedule.installmentsJson);
  db.update(schema.loanSchedules)
    .set({
      installmentsJson: JSON.stringify({ ...stored, remindersEnabled: enabled }),
    })
    .where(eq(schema.loanSchedules.id, scheduleId))
    .run();
}

export function updateLoanScheduleSettings(
  db: AppDb,
  scheduleId: number,
  input: LoanScheduleSettingsInput,
): void {
  const name = input.name.trim();
  if (!name) throw new Error('A schedule name is required.');
  const schedule = db
    .select()
    .from(schema.loanSchedules)
    .where(eq(schema.loanSchedules.id, scheduleId))
    .get();
  if (!schedule) throw new Error('The repayment schedule does not exist.');

  db.update(schema.loanSchedules)
    .set({
      name,
      installmentsJson: updateStoredLoanScheduleSettings(schedule.installmentsJson, input),
    })
    .where(eq(schema.loanSchedules.id, scheduleId))
    .run();
}

export function deleteLoanSchedule(db: AppDb, scheduleId: number): void {
  db.delete(schema.loanSchedules).where(eq(schema.loanSchedules.id, scheduleId)).run();
}
