import { eq } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';
import {
  validateGoal,
  validateValuation,
  type GoalInput,
  type ValuationInput,
} from '../domain/goals';

export type SavingsGoal = typeof schema.savingsGoals.$inferSelect;

export function saveGoal(db: AppDb, input: GoalInput, id?: number): void {
  validateGoal(input);
  const values = { ...input, name: input.name.trim(), updatedAt: Date.now() };
  if (id !== undefined) {
    db.update(schema.savingsGoals).set(values).where(eq(schema.savingsGoals.id, id)).run();
  } else {
    db.insert(schema.savingsGoals)
      .values({ ...values, createdAt: values.updatedAt })
      .run();
  }
}

export function deleteGoal(db: AppDb, id: number): void {
  db.delete(schema.savingsGoals).where(eq(schema.savingsGoals.id, id)).run();
}

export function saveValuation(db: AppDb, input: ValuationInput): void {
  validateValuation(input);
  if (input.valuedAt > Date.now()) throw new Error('A valuation cannot be in the future.');
  db.insert(schema.investmentValuations)
    .values(input)
    .onConflictDoUpdate({
      target: schema.investmentValuations.assetId,
      set: input,
    })
    .run();
}
