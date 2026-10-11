import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { schema, useDb } from '@/core/db';

import { buildTaxonomy, type GroupWithCategories } from '../domain/taxonomy';

/** Groups with their categories; pass `kind` to keep only expense or income groups. */
export function useTaxonomy({
  kind,
  includeArchived = false,
}: { kind?: 'expense' | 'income'; includeArchived?: boolean } = {}): GroupWithCategories[] {
  const db = useDb();
  const { data: groups } = useLiveQuery(db.select().from(schema.categoryGroups));
  const { data: categories } = useLiveQuery(db.select().from(schema.categories));

  return useMemo(() => {
    const taxonomy = buildTaxonomy(groups, categories, { includeArchived });
    return kind ? taxonomy.filter((group) => group.kind === kind) : taxonomy;
  }, [groups, categories, kind, includeArchived]);
}
