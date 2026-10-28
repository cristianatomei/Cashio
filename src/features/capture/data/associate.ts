import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';
import { normalizeMerchant } from '@/features/parsing';
import { findRecurringMatch, nextDueAfterPayment } from '@/features/recurring';

export type AssociateInput = {
  merchantRaw: string;
  merchantId: number;
  categoryId: number;
  /** Saves the raw name as an alias so the next payment is classified automatically. */
  remember: boolean;
  selectedIds?: readonly number[];
};

function draftsMatching(db: AppDb, merchantRaw: string) {
  const key = normalizeMerchant(merchantRaw) || merchantRaw;
  return db
    .select()
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.status, 'draft'),
        isNull(schema.transactions.merchantId),
        isNotNull(schema.transactions.merchantRaw),
      ),
    )
    .all()
    .filter(
      (draft) =>
        draft.merchantRaw && (normalizeMerchant(draft.merchantRaw) || draft.merchantRaw) === key,
    );
}

/** Links every pending payment with this raw merchant name and confirms them; returns the count. */
export function associateMerchant(db: AppDb, input: AssociateInput): number {
  const pattern = normalizeMerchant(input.merchantRaw);

  return db.transaction((tx) => {
    if (input.remember && pattern) {
      tx.insert(schema.merchantAliases)
        .values({ merchantId: input.merchantId, rawPattern: pattern, matchType: 'contains' })
        .onConflictDoUpdate({
          target: [schema.merchantAliases.rawPattern, schema.merchantAliases.matchType],
          set: { merchantId: input.merchantId },
        })
        .run();
    }

    if (input.remember) {
      tx.update(schema.merchants)
        .set({ defaultCategoryId: input.categoryId })
        .where(
          and(
            eq(schema.merchants.id, input.merchantId),
            isNull(schema.merchants.defaultCategoryId),
          ),
        )
        .run();
    }

    const drafts = draftsMatching(db, input.merchantRaw).filter(
      (draft) => !input.selectedIds || input.selectedIds.includes(draft.id),
    );
    if (drafts.length > 0) {
      tx.update(schema.transactions)
        .set({
          merchantId: input.merchantId,
          categoryId: input.categoryId,
          status: 'confirmed',
          updatedAt: Date.now(),
        })
        .where(
          inArray(
            schema.transactions.id,
            drafts.map((draft) => draft.id),
          ),
        )
        .run();

      const recurringRules = tx.select().from(schema.recurringRules).all();
      for (const draft of drafts) {
        const accountId = draft.accountId;
        if (accountId === null) continue;
        const match = findRecurringMatch(
          { ...draft, accountId, merchantId: input.merchantId, categoryId: input.categoryId },
          recurringRules,
        );
        if (!match) continue;
        tx.update(schema.transactions)
          .set({ recurringId: match.id })
          .where(eq(schema.transactions.id, draft.id))
          .run();
        const nextDue = nextDueAfterPayment(match, draft.occurredAt);
        tx.update(schema.recurringRules)
          .set({ nextDue })
          .where(eq(schema.recurringRules.id, match.id))
          .run();
        match.nextDue = nextDue;
      }
    }
    return drafts.length;
  });
}

/** Deletes the pending payments with this raw merchant name (not a real expense, or a duplicate). */
export function dismissDrafts(db: AppDb, merchantRaw: string): number {
  const ids = draftsMatching(db, merchantRaw).map((draft) => draft.id);
  if (ids.length > 0) {
    db.delete(schema.transactions).where(inArray(schema.transactions.id, ids)).run();
  }
  return ids.length;
}
