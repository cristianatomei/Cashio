import { eq } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';
import { parseAmountToMinor } from '@/core/utils/money';

export type RecurringRule = typeof schema.recurringRules.$inferSelect;
export type RecurringFrequency = RecurringRule['frequency'];

export type RecurringInput = {
  id?: number;
  accountId: number;
  type: 'expense' | 'income';
  amountMinor: number;
  amountVariable: boolean;
  currency: string;
  categoryId: number | null;
  merchantId: number | null;
  note: string | null;
  frequency: RecurringFrequency;
  interval: number;
  nextDue: number;
};

export function saveRecurringRule(db: AppDb, input: RecurringInput): number {
  const now = Date.now();
  const values = {
    accountId: input.accountId,
    type: input.type,
    amountMinor: input.amountMinor,
    amountVariable: input.amountVariable,
    currency: input.currency,
    categoryId: input.categoryId,
    merchantId: input.merchantId,
    note: input.note?.trim() || null,
    frequency: input.frequency,
    interval: input.interval,
    nextDue: input.nextDue,
  };

  if (input.id !== undefined) {
    db.update(schema.recurringRules).set(values).where(eq(schema.recurringRules.id, input.id)).run();
    return input.id;
  }

  return db
    .insert(schema.recurringRules)
    .values({ ...values, createdAt: now })
    .returning({ id: schema.recurringRules.id })
    .get().id;
}

export function setRecurringRuleActive(db: AppDb, id: number, active: boolean): void {
  db.update(schema.recurringRules).set({ active }).where(eq(schema.recurringRules.id, id)).run();
}

export function deleteRecurringRule(db: AppDb, id: number): void {
  db.delete(schema.recurringRules).where(eq(schema.recurringRules.id, id)).run();
}

export function parseRecurringAmount(value: string): number | null {
  return parseAmountToMinor(value);
}