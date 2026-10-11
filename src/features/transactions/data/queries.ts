import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { schema, useDb } from '@/core/db';

import { composeTransactionViews, type TransactionView } from '../domain/views';

type Scope = { range?: { from: number; to: number }; draftsOnly?: boolean };

function useViews({ range, draftsOnly }: Scope): TransactionView[] {
  const db = useDb();

  const conditions = [
    range ? gte(schema.transactions.occurredAt, range.from) : undefined,
    range ? lt(schema.transactions.occurredAt, range.to) : undefined,
    draftsOnly ? eq(schema.transactions.status, 'draft') : undefined,
  ].filter((condition) => condition !== undefined);

  const { data: transactions } = useLiveQuery(
    db
      .select()
      .from(schema.transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.transactions.occurredAt)),
    [range?.from, range?.to, draftsOnly],
  );
  const { data: accounts } = useLiveQuery(db.select().from(schema.accounts));
  const { data: groups } = useLiveQuery(db.select().from(schema.categoryGroups));
  const { data: categories } = useLiveQuery(db.select().from(schema.categories));
  const { data: merchants } = useLiveQuery(db.select().from(schema.merchants));
  const { data: tags } = useLiveQuery(db.select().from(schema.tags));
  const { data: tagLinks } = useLiveQuery(db.select().from(schema.transactionTags));
  const { data: allocations } = useLiveQuery(db.select().from(schema.transactionAllocations));

  return useMemo(
    () =>
      composeTransactionViews({
        transactions,
        accounts,
        groups,
        categories,
        merchants,
        tags,
        tagLinks,
        allocations,
      }),
    [transactions, accounts, groups, categories, merchants, tags, tagLinks, allocations],
  );
}

/** Transactions with names and colors resolved; `range` is half-open [from, to). */
export function useTransactionViews(range?: { from: number; to: number }): TransactionView[] {
  return useViews({ range });
}

/** Captured payments waiting for the user to classify them. */
export function useDraftViews(): TransactionView[] {
  return useViews({ draftsOnly: true });
}
