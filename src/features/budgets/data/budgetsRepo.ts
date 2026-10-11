import { eq } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';
import { parseAmountToMinor } from '@/core/utils/money';

export type Budget = typeof schema.budgets.$inferSelect;

export type BudgetInput = {
  id?: number;
  categoryId: number | null;
  groupId: number | null;
  amountMinor: number;
  currency: string;
  rollover: boolean;
};

export function saveBudget(db: AppDb, input: BudgetInput): number {
  if (
    (input.categoryId === null) === (input.groupId === null) ||
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    !/^[A-Z]{3}$/.test(input.currency)
  ) {
    throw new Error('Invalid budget');
  }

  const duplicate = db
    .select()
    .from(schema.budgets)
    .all()
    .find(
      (budget) =>
        budget.id !== input.id &&
        budget.currency === input.currency &&
        budget.categoryId === input.categoryId &&
        budget.groupId === input.groupId,
    );
  if (duplicate) throw new Error('A budget already exists for this category or group');

  const values = {
    categoryId: input.categoryId,
    groupId: input.groupId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    rollover: input.rollover,
  };
  if (input.id !== undefined) {
    db.update(schema.budgets).set(values).where(eq(schema.budgets.id, input.id)).run();
    return input.id;
  }
  return db
    .insert(schema.budgets)
    .values({ ...values, createdAt: Date.now() })
    .returning({ id: schema.budgets.id })
    .get().id;
}

export function deleteBudget(db: AppDb, id: number): void {
  db.delete(schema.budgets).where(eq(schema.budgets.id, id)).run();
}

export function parseBudgetAmount(value: string): number | null {
  return parseAmountToMinor(value);
}
