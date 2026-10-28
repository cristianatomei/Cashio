import { and, eq, inArray, sql } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';
import { findRecurringMatch, nextDueAfterPayment } from '@/features/recurring';
import { normalizeMerchant } from '@/features/parsing';
import { associateMerchant, type AssociateInput } from '@/features/capture/data/associate';

import { parseSavedFilter, type SavedFilter } from '../domain/savedFilters';
import { validateTransaction } from '../domain/validation';

type Row = typeof schema.transactions.$inferSelect;
export type BatchAction =
  | { kind: 'delete' }
  | { kind: 'confirm' }
  | { kind: 'category'; categoryId: number }
  | { kind: 'account'; accountId: number }
  | { kind: 'tags'; tagIds: number[] };

function snapshot(db: AppDb, ids: number[]) {
  const rows = db
    .select()
    .from(schema.transactions)
    .where(inArray(schema.transactions.id, ids))
    .all();
  const rawIds = rows.flatMap((row) =>
    row.rawNotificationId === null ? [] : [row.rawNotificationId],
  );
  return {
    rows,
    tags: db
      .select()
      .from(schema.transactionTags)
      .where(inArray(schema.transactionTags.transactionId, ids))
      .all(),
    allocations: db
      .select()
      .from(schema.transactionAllocations)
      .where(inArray(schema.transactionAllocations.transactionId, ids))
      .all(),
    raw: rawIds.length
      ? db
          .select()
          .from(schema.rawNotifications)
          .where(inArray(schema.rawNotifications.id, rawIds))
          .all()
      : [],
    // The planning feature may be merged before or after this append-only migration.
    loanLinks: db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'loan_payment_links'`,
    ).length
      ? db.all<{ id: number; schedule_id: number; due_at: number; transaction_id: number }>(
          sql`SELECT id, schedule_id, due_at, transaction_id FROM loan_payment_links WHERE transaction_id IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )}) ORDER BY transaction_id`,
        )
      : [],
  };
}

type Snapshot = ReturnType<typeof snapshot>;
export type BatchUndo = {
  ids: number[];
  before: Snapshot;
  after: Snapshot;
  recurring: { id: number; before: number; after: number }[];
  association?: {
    merchantId: number;
    pattern: string;
    type: 'expense' | 'income';
    before: ReturnType<typeof associationState>;
    after: ReturnType<typeof associationState>;
  };
};

function associationState(
  db: AppDb,
  merchantId: number,
  pattern: string,
  type: 'expense' | 'income',
) {
  return {
    merchant: db.select().from(schema.merchants).where(eq(schema.merchants.id, merchantId)).get(),
    alias: db
      .select()
      .from(schema.merchantAliases)
      .where(
        and(
          eq(schema.merchantAliases.rawPattern, pattern),
          eq(schema.merchantAliases.matchType, 'contains'),
        ),
      )
      .get(),
    rule: db
      .select()
      .from(schema.merchantCategoryRules)
      .where(
        and(
          eq(schema.merchantCategoryRules.merchantId, merchantId),
          eq(schema.merchantCategoryRules.type, type),
        ),
      )
      .get(),
  };
}

export function applyAssociation(db: AppDb, ids: number[], input: AssociateInput): BatchUndo {
  if (!ids.length) throw new Error('Select at least one draft.');
  return db.transaction((tx) => {
    const before = snapshot(tx, ids);
    if (
      before.rows.length !== ids.length ||
      before.rows.some((row) => row.status !== 'draft' || row.type === 'transfer')
    )
      throw new Error('Drafts changed.');
    validateCategory(tx, input.categoryId, before.rows);
    if (ids.some((id) => before.allocations.filter((item) => item.transactionId === id).length > 1))
      throw new Error('Edit split payments individually.');
    const type = before.rows[0].type as 'expense' | 'income';
    const pattern = normalizeMerchant(input.merchantRaw);
    const metadata = associationState(tx, input.merchantId, pattern, type);
    if (!metadata.merchant) throw new Error('Merchant no longer exists.');
    const recurringBefore = tx.select().from(schema.recurringRules).all();
    const count = associateMerchant(tx, { ...input, selectedIds: ids });
    if (count !== ids.length) throw new Error('Drafts changed.');
    if (input.remember) saveMerchantRule(tx, input.merchantId, type, input.categoryId, false);
    tx.update(schema.transactionAllocations)
      .set({ categoryId: input.categoryId })
      .where(inArray(schema.transactionAllocations.transactionId, ids))
      .run();
    for (const row of before.raw)
      tx.update(schema.rawNotifications)
        .set({ reviewStatus: 'handled' })
        .where(eq(schema.rawNotifications.id, row.id))
        .run();
    const recurringAfter = tx.select().from(schema.recurringRules).all();
    return {
      ids,
      before,
      after: snapshot(tx, ids),
      recurring: recurringBefore.flatMap((rule) => {
        const after = recurringAfter.find((item) => item.id === rule.id);
        return after && after.nextDue !== rule.nextDue
          ? [{ id: rule.id, before: rule.nextDue, after: after.nextDue }]
          : [];
      }),
      association: {
        merchantId: input.merchantId,
        pattern,
        type,
        before: metadata,
        after: associationState(tx, input.merchantId, pattern, type),
      },
    };
  });
}

function validateCategory(db: AppDb, categoryId: number, rows: Pick<Row, 'type'>[]) {
  const category = db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, categoryId))
    .get();
  const group =
    category &&
    db
      .select()
      .from(schema.categoryGroups)
      .where(eq(schema.categoryGroups.id, category.groupId))
      .get();
  if (
    !category ||
    category.archived ||
    !group ||
    group.archived ||
    rows.some((row) => row.type !== group.kind)
  ) {
    throw new Error('The category must match every selected transaction type.');
  }
}

/** Every operation is atomic. Split rows cannot silently lose allocations. */
export function applyBatch(
  db: AppDb,
  selectedIds: readonly number[],
  action: BatchAction,
): BatchUndo {
  const ids = [...new Set(selectedIds)];
  if (!ids.length) throw new Error('Select at least one transaction.');
  return db.transaction((tx) => {
    const before = snapshot(tx, ids);
    if (before.rows.length !== ids.length)
      throw new Error('Some selected transactions no longer exist.');
    if (action.kind === 'category') {
      validateCategory(tx, action.categoryId, before.rows);
      if (
        ids.some((id) => before.allocations.filter((item) => item.transactionId === id).length > 1)
      ) {
        throw new Error('Edit split categories individually.');
      }
    }
    if (action.kind === 'account') {
      const account = tx
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, action.accountId))
        .get();
      if (
        !account ||
        account.archived ||
        before.rows.some(
          (row) => row.currency !== account.currency || row.transferAccountId === account.id,
        )
      ) {
        throw new Error(
          'Choose an active account with the same currency, different from the destination.',
        );
      }
    }
    if (action.kind === 'tags') {
      const uniqueTags = [...new Set(action.tagIds)];
      const tags = uniqueTags.length
        ? tx.select().from(schema.tags).where(inArray(schema.tags.id, uniqueTags)).all()
        : [];
      if (tags.length !== uniqueTags.length) throw new Error('A selected tag no longer exists.');
    }
    const recurring: BatchUndo['recurring'] = [];
    for (const row of before.rows) {
      if (action.kind === 'delete') {
        tx.delete(schema.transactions).where(eq(schema.transactions.id, row.id)).run();
      } else if (action.kind === 'category') {
        tx.update(schema.transactions)
          .set({ categoryId: action.categoryId, updatedAt: Date.now() })
          .where(eq(schema.transactions.id, row.id))
          .run();
        tx.update(schema.transactionAllocations)
          .set({ categoryId: action.categoryId })
          .where(eq(schema.transactionAllocations.transactionId, row.id))
          .run();
      } else if (action.kind === 'account') {
        tx.update(schema.transactions)
          .set({ accountId: action.accountId, updatedAt: Date.now() })
          .where(eq(schema.transactions.id, row.id))
          .run();
      } else if (action.kind === 'tags') {
        // Add tags, never replace unrelated existing tags.
        for (const tagId of new Set(action.tagIds)) {
          tx.insert(schema.transactionTags)
            .values({ transactionId: row.id, tagId })
            .onConflictDoNothing()
            .run();
        }
      } else {
        const category =
          row.categoryId === null
            ? null
            : tx
                .select()
                .from(schema.categories)
                .where(eq(schema.categories.id, row.categoryId))
                .get();
        const allocations = before.allocations.filter((item) => item.transactionId === row.id);
        const invalid = validateTransaction({
          ...row,
          allocations: allocations.length > 1 ? allocations : undefined,
        });
        if (row.type !== 'transfer' && category) {
          validateCategory(tx, category.id, [row]);
          for (const allocation of allocations) {
            if (allocation.categoryId !== null) validateCategory(tx, allocation.categoryId, [row]);
          }
        }
        if (row.status !== 'draft' || invalid || (row.type !== 'transfer' && !category))
          throw new Error('Review missing category or transfer accounts before confirming.');
        const rules = tx.select().from(schema.recurringRules).all();
        const match =
          row.recurringId || row.accountId === null
            ? null
            : findRecurringMatch({ ...row, accountId: row.accountId }, rules);
        tx.update(schema.transactions)
          .set({
            status: 'confirmed',
            recurringId: match?.id ?? row.recurringId,
            updatedAt: Date.now(),
          })
          .where(eq(schema.transactions.id, row.id))
          .run();
        if (match) {
          const nextDue = nextDueAfterPayment(match, row.occurredAt);
          const changed = recurring.find((item) => item.id === match.id);
          if (changed) changed.after = nextDue;
          else recurring.push({ id: match.id, before: match.nextDue, after: nextDue });
          tx.update(schema.recurringRules)
            .set({ nextDue })
            .where(eq(schema.recurringRules.id, match.id))
            .run();
        }
      }
      if (
        (action.kind === 'delete' || action.kind === 'confirm') &&
        row.rawNotificationId !== null
      ) {
        tx.update(schema.rawNotifications)
          .set({ reviewStatus: action.kind === 'delete' ? 'ignored' : 'handled' })
          .where(eq(schema.rawNotifications.id, row.rawNotificationId))
          .run();
      }
    }
    return { ids, before, after: snapshot(tx, ids), recurring };
  });
}

/** Refuses stale undo rather than overwriting newer edits/capture state. */
export function undoBatch(db: AppDb, undo: BatchUndo): void {
  db.transaction((tx) => {
    if (undo.association) {
      const state = undo.association;
      if (
        JSON.stringify(associationState(tx, state.merchantId, state.pattern, state.type)) !==
        JSON.stringify(state.after)
      )
        throw new Error('Merchant learning changed after the action.');
    }
    const current = snapshot(tx, undo.ids);
    // Deleted rows do not expose raw ids anymore: compare the original raw links explicitly.
    const raw = undo.before.raw.map((row) =>
      tx.select().from(schema.rawNotifications).where(eq(schema.rawNotifications.id, row.id)).get(),
    );
    const expectedRaw = undo.before.raw.map(
      (row) =>
        undo.after.raw.find((item) => item.id === row.id) ?? { ...row, reviewStatus: 'ignored' },
    );
    if (
      JSON.stringify({ ...current, raw: [] }) !== JSON.stringify({ ...undo.after, raw: [] }) ||
      JSON.stringify(raw) !== JSON.stringify(expectedRaw)
    ) {
      throw new Error(
        'These transactions changed after the action. Undo cannot overwrite newer data.',
      );
    }
    for (const rule of undo.recurring) {
      if (
        tx.select().from(schema.recurringRules).where(eq(schema.recurringRules.id, rule.id)).get()
          ?.nextDue !== rule.after
      ) {
        throw new Error('The recurring schedule changed. Undo cannot overwrite newer data.');
      }
    }
    for (const row of undo.before.rows) {
      tx.insert(schema.transactions)
        .values(row)
        .onConflictDoUpdate({ target: schema.transactions.id, set: row })
        .run();
    }
    tx.delete(schema.transactionTags)
      .where(inArray(schema.transactionTags.transactionId, undo.ids))
      .run();
    tx.delete(schema.transactionAllocations)
      .where(inArray(schema.transactionAllocations.transactionId, undo.ids))
      .run();
    if (undo.before.tags.length) tx.insert(schema.transactionTags).values(undo.before.tags).run();
    if (undo.before.allocations.length)
      tx.insert(schema.transactionAllocations).values(undo.before.allocations).run();
    for (const link of undo.before.loanLinks) {
      tx.run(
        sql`INSERT INTO loan_payment_links (id, schedule_id, due_at, transaction_id) VALUES (${link.id}, ${link.schedule_id}, ${link.due_at}, ${link.transaction_id}) ON CONFLICT(transaction_id) DO NOTHING`,
      );
    }
    for (const row of undo.before.raw)
      tx.update(schema.rawNotifications)
        .set({ reviewStatus: row.reviewStatus })
        .where(eq(schema.rawNotifications.id, row.id))
        .run();
    for (const rule of undo.recurring)
      tx.update(schema.recurringRules)
        .set({ nextDue: rule.before })
        .where(eq(schema.recurringRules.id, rule.id))
        .run();
    if (undo.association) {
      const state = undo.association;
      tx.update(schema.merchants)
        .set({ defaultCategoryId: state.before.merchant?.defaultCategoryId ?? null })
        .where(eq(schema.merchants.id, state.merchantId))
        .run();
      tx.delete(schema.merchantAliases)
        .where(
          and(
            eq(schema.merchantAliases.rawPattern, state.pattern),
            eq(schema.merchantAliases.matchType, 'contains'),
          ),
        )
        .run();
      if (state.before.alias) tx.insert(schema.merchantAliases).values(state.before.alias).run();
      tx.delete(schema.merchantCategoryRules)
        .where(
          and(
            eq(schema.merchantCategoryRules.merchantId, state.merchantId),
            eq(schema.merchantCategoryRules.type, state.type),
          ),
        )
        .run();
      if (state.before.rule)
        tx.insert(schema.merchantCategoryRules).values(state.before.rule).run();
    }
  });
}

export function saveFilter(db: AppDb, name: string, filter: SavedFilter): void {
  if (!name.trim()) throw new Error('A view name is required.');
  parseSavedFilter(JSON.stringify(filter));
  db.insert(schema.savedTransactionFilters)
    .values({ name: name.trim(), filterJson: JSON.stringify(filter), createdAt: Date.now() })
    .run();
}

export function saveMerchantRule(
  db: AppDb,
  merchantId: number,
  type: 'expense' | 'income',
  categoryId: number,
  retroactive: boolean,
): void {
  db.transaction((tx) => {
    validateCategory(tx, categoryId, [{ type }]);
    tx.insert(schema.merchantCategoryRules)
      .values({ merchantId, type, categoryId, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: [schema.merchantCategoryRules.merchantId, schema.merchantCategoryRules.type],
        set: { categoryId, updatedAt: Date.now() },
      })
      .run();
    if (retroactive) {
      const rows = tx
        .select()
        .from(schema.transactions)
        .where(
          and(eq(schema.transactions.merchantId, merchantId), eq(schema.transactions.type, type)),
        )
        .all();
      // Split history retains its allocation semantics; manage it individually.
      const allocations = tx.select().from(schema.transactionAllocations).all();
      const ids = rows
        .filter((row) => allocations.filter((item) => item.transactionId === row.id).length <= 1)
        .map((row) => row.id);
      if (ids.length) applyBatch(tx, ids, { kind: 'category', categoryId });
    }
  });
}
