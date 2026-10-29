import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@/core/db';
import * as schema from '@/core/db/schema';
import { parseStoredLoanSchedule } from '../domain/storedSchedule';

/** Only an explicit user confirmation may create a settlement association. */
export function confirmLoanPayment(
  db: AppDb,
  scheduleId: number,
  dueAt: number,
  transactionId: number,
  now = Date.now(),
): void {
  db.transaction((tx) => {
    const schedule = tx
      .select()
      .from(schema.loanSchedules)
      .where(eq(schema.loanSchedules.id, scheduleId))
      .get();
    const payment = tx
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .get();
    if (
      !schedule ||
      !parseStoredLoanSchedule(schedule.installmentsJson).installments.some(
        (installment) => installment.dueAt === dueAt,
      ) ||
      !payment ||
      payment.status !== 'confirmed' ||
      payment.type !== 'expense' ||
      payment.currency !== schedule.currency ||
      !Number.isSafeInteger(payment.amountMinor) ||
      payment.amountMinor <= 0 ||
      payment.occurredAt > now ||
      (payment.recurringId !== null && payment.recurringId !== schedule.recurringId)
    ) {
      throw new Error('Invalid loan payment association.');
    }
    tx.insert(schema.loanPaymentLinks).values({ scheduleId, dueAt, transactionId }).run();
  });
}

export function unlinkLoanPayment(db: AppDb, scheduleId: number, dueAt: number): void {
  db.delete(schema.loanPaymentLinks)
    .where(
      and(
        eq(schema.loanPaymentLinks.scheduleId, scheduleId),
        eq(schema.loanPaymentLinks.dueAt, dueAt),
      ),
    )
    .run();
}
