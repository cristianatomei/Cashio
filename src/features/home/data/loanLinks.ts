import { eq } from 'drizzle-orm';
import type { AppDb } from '@/core/db';
import * as schema from '@/core/db/schema';

/** Explicit, one-to-one association only; never infer identity from amount or text. */
export function saveHomeLoanLink(db: AppDb, loanId: number, recurringId: number | null) {
  db.transaction((tx) => {
    const loan = tx
      .select()
      .from(schema.loanSchedules)
      .where(eq(schema.loanSchedules.id, loanId))
      .get();
    if (!loan) throw new Error('Missing loan schedule');
    if (recurringId !== null) {
      const rule = tx
        .select()
        .from(schema.recurringRules)
        .where(eq(schema.recurringRules.id, recurringId))
        .get();
      const links = tx
        .select()
        .from(schema.loanSchedules)
        .where(eq(schema.loanSchedules.recurringId, recurringId))
        .all();
      if (
        !rule ||
        rule.type !== 'expense' ||
        rule.currency !== loan.currency ||
        links.some((link) => link.id !== loanId)
      ) {
        throw new Error('Invalid recurring association');
      }
    }
    tx.update(schema.loanSchedules)
      .set({ recurringId })
      .where(eq(schema.loanSchedules.id, loanId))
      .run();
  });
}
