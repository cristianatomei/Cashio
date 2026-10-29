import type {
  LoanPaymentForReconciliation,
  LoanPaymentLink,
  LoanScheduleForReconciliation,
} from './reconciliation';

export type LoanSettlementPayment = Pick<
  LoanPaymentForReconciliation,
  'id' | 'type' | 'status' | 'amountMinor' | 'currency' | 'occurredAt'
> & { recurringId: number | null };

/** Revalidate saved associations: invalid or stale rows must never suppress obligations. */
export function confirmedLoanSettlements(
  schedules: readonly LoanScheduleForReconciliation[],
  payments: readonly LoanSettlementPayment[],
  links: readonly LoanPaymentLink[],
  now: number,
) {
  const settled = new Map<string, number>();
  const linkedTransactions = new Set<number>();
  for (const link of links) {
    const schedule = schedules.find((item) => item.id === link.scheduleId);
    const payment = payments.find((item) => item.id === link.transactionId);
    if (
      !schedule ||
      !payment ||
      linkedTransactions.has(payment.id) ||
      settled.has(`${link.scheduleId}:${link.dueAt}`) ||
      payment.status !== 'confirmed' ||
      payment.type !== 'expense' ||
      payment.currency !== schedule.currency ||
      !Number.isSafeInteger(payment.amountMinor) ||
      payment.amountMinor <= 0 ||
      !Number.isSafeInteger(payment.occurredAt) ||
      payment.occurredAt > now ||
      (payment.recurringId !== null && payment.recurringId !== schedule.recurringId) ||
      !schedule.installments.some((installment) => installment.dueAt === link.dueAt)
    )
      continue;
    settled.set(`${link.scheduleId}:${link.dueAt}`, payment.amountMinor);
    linkedTransactions.add(payment.id);
  }
  return { settled, linkedTransactions };
}
