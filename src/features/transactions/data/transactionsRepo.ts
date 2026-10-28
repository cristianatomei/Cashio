import { and, eq, lte, or, sql } from 'drizzle-orm';

import { DEFAULT_CURRENCY } from '@/core/db';
import type { TransactionType } from '@/core/domain/transaction';
import { schema, type AppDb } from '@/core/db';
import { convertToBaseMinor } from '@/core/utils/currency';
import { ratePreferenceOrder } from '@/features/exchange-rates/data/rateOrder';
import { cleanupReceipts, loadReceipt } from '@/features/receipts/data/repo';
import {
  findRecurringMatch,
  nextDueAfterPayment,
  type RecurringMatchRule,
} from '@/features/recurring';

export type TransactionInput = {
  id?: number;
  type: TransactionType;
  accountId: number | null;
  transferAccountId: number | null;
  amountMinor: number;
  currency: string;
  categoryId: number | null;
  merchantId: number | null;
  note: string | null;
  tagIds: number[];
  allocations?: { categoryId: number | null; amountMinor: number }[];
  occurredAt: number;
};

function matchRecurring(
  input: TransactionInput,
  rules: RecurringMatchRule[],
): RecurringMatchRule | null {
  if (input.accountId === null) return null;
  const accountId = input.accountId;
  return findRecurringMatch({ ...input, accountId }, rules);
}

/** Saving a transaction always confirms it, so reviewing a captured draft finalizes it. */
export function saveTransaction(db: AppDb, input: TransactionInput): number {
  const isTransfer = input.type === 'transfer';
  const now = Date.now();
  const baseCurrency =
    db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'base_currency'))
      .get()?.value ?? DEFAULT_CURRENCY;
  const exchangeRate =
    input.currency === baseCurrency
      ? 1
      : db
          .select({ rateToBase: schema.exchangeRates.rateToBase })
          .from(schema.exchangeRates)
          .where(
            and(
              eq(schema.exchangeRates.currency, input.currency),
              lte(schema.exchangeRates.effectiveAt, input.occurredAt),
              or(
                eq(schema.exchangeRates.source, 'manual'),
                eq(schema.exchangeRates.source, `frankfurter:ECB:${baseCurrency}`),
              ),
            ),
          )
          .orderBy(...ratePreferenceOrder())
          .limit(1)
          .get()?.rateToBase;
  const values = {
    accountId: input.accountId,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    baseAmountMinor:
      exchangeRate === undefined ? null : convertToBaseMinor(input.amountMinor, exchangeRate),
    fxRate: exchangeRate ?? null,
    categoryId: isTransfer ? null : input.categoryId,
    merchantId: isTransfer ? null : input.merchantId,
    note: input.note?.trim() || null,
    transferAccountId: isTransfer ? input.transferAccountId : null,
    status: 'confirmed' as const,
    occurredAt: input.occurredAt,
    updatedAt: now,
  };

  return db.transaction((tx) => {
    let id: number;
    let matchedRuleId: number | null = null;
    let matchedNextDue: number | null = null;
    if (input.id !== undefined) {
      let linkedLoanRecurringId: number | null | undefined;
      if (
        tx.all<{ name: string }>(
          sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'loan_payment_links'`,
        ).length
      ) {
        const linked = tx.all<{ currency: string; recurring_id: number | null }>(
          sql`SELECT loan_schedules.currency, loan_schedules.recurring_id FROM loan_payment_links JOIN loan_schedules ON loan_schedules.id = loan_payment_links.schedule_id WHERE transaction_id = ${input.id}`,
        );
        if (
          linked.some(
            (schedule) =>
              input.type !== 'expense' ||
              input.currency !== schedule.currency ||
              input.occurredAt > now,
          )
        ) {
          throw new Error(
            'Unlink the loan installment before changing its payment type or currency.',
          );
        }
        linkedLoanRecurringId = linked[0]?.recurring_id;
      }
      const existing = tx
        .select({ recurringId: schema.transactions.recurringId })
        .from(schema.transactions)
        .where(eq(schema.transactions.id, input.id))
        .get();
      if (!existing) throw new Error('The transaction no longer exists.');
      const recurringRules = tx.select().from(schema.recurringRules).all();
      const recurringMatch = existing?.recurringId ? null : matchRecurring(input, recurringRules);
      const nextRecurringId = recurringMatch?.id ?? existing.recurringId;
      if (
        linkedLoanRecurringId !== undefined &&
        nextRecurringId !== null &&
        nextRecurringId !== linkedLoanRecurringId
      ) {
        throw new Error(
          'Unlink the loan installment before matching another recurring obligation.',
        );
      }
      tx.update(schema.transactions)
        .set({ ...values, recurringId: recurringMatch?.id ?? existing?.recurringId ?? null })
        .where(eq(schema.transactions.id, input.id))
        .run();
      id = input.id;
      if (recurringMatch) {
        matchedRuleId = recurringMatch.id;
        matchedNextDue = nextDueAfterPayment(recurringMatch, input.occurredAt);
      }
    } else {
      const recurringRules = tx.select().from(schema.recurringRules).all();
      const recurringMatch = matchRecurring(input, recurringRules);
      id = tx
        .insert(schema.transactions)
        .values({
          ...values,
          recurringId: recurringMatch?.id ?? null,
          source: 'manual',
          createdAt: now,
        })
        .returning({ id: schema.transactions.id })
        .get().id;
      if (recurringMatch) {
        matchedRuleId = recurringMatch.id;
        matchedNextDue = nextDueAfterPayment(recurringMatch, input.occurredAt);
      }
    }

    if (matchedRuleId !== null && matchedNextDue !== null) {
      tx.update(schema.recurringRules)
        .set({ nextDue: matchedNextDue })
        .where(eq(schema.recurringRules.id, matchedRuleId))
        .run();
    }

    tx.delete(schema.transactionTags).where(eq(schema.transactionTags.transactionId, id)).run();
    if (input.tagIds.length > 0) {
      tx.insert(schema.transactionTags)
        .values(input.tagIds.map((tagId) => ({ transactionId: id, tagId })))
        .run();
    }
    tx.delete(schema.transactionAllocations)
      .where(eq(schema.transactionAllocations.transactionId, id))
      .run();
    if (input.allocations && input.allocations.length > 0) {
      tx.insert(schema.transactionAllocations)
        .values(
          input.allocations.map((allocation) => ({
            transactionId: id,
            categoryId: allocation.categoryId,
            amountMinor: allocation.amountMinor,
          })),
        )
        .run();
    }
    return id;
  });
}

export function deleteTransaction(db: AppDb, id: number): void {
  const receipt = loadReceipt(db, id);
  db.delete(schema.transactions).where(eq(schema.transactions.id, id)).run();
  cleanupReceipts(db, receipt ? [receipt] : []);
}

export function loadTransaction(db: AppDb, id: number): TransactionInput | null {
  const row = db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).get();
  if (!row) return null;

  const tagIds = db
    .select({ tagId: schema.transactionTags.tagId })
    .from(schema.transactionTags)
    .where(eq(schema.transactionTags.transactionId, id))
    .all()
    .map((link) => link.tagId);
  const allocations = db
    .select({
      categoryId: schema.transactionAllocations.categoryId,
      amountMinor: schema.transactionAllocations.amountMinor,
    })
    .from(schema.transactionAllocations)
    .where(eq(schema.transactionAllocations.transactionId, id))
    .all();

  return {
    id: row.id,
    type: row.type,
    accountId: row.accountId,
    transferAccountId: row.transferAccountId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    categoryId: row.categoryId,
    merchantId: row.merchantId,
    note: row.note,
    tagIds,
    ...(allocations.length > 0 ? { allocations } : {}),
    occurredAt: row.occurredAt,
  };
}
