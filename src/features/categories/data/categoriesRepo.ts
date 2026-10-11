import { count, eq, max } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';

export type GroupInput = {
  id?: number;
  name: string;
  kind: 'expense' | 'income';
  color: string;
  icon: string;
};

export type CategoryInput = {
  id?: number;
  groupId: number;
  name: string;
  icon: string;
};

export function saveGroup(db: AppDb, input: GroupInput): number {
  const values = {
    name: input.name.trim(),
    kind: input.kind,
    color: input.color,
    icon: input.icon,
  };

  if (input.id !== undefined) {
    db.update(schema.categoryGroups).set(values).where(eq(schema.categoryGroups.id, input.id)).run();
    return input.id;
  }

  const last = db
    .select({ value: max(schema.categoryGroups.sortOrder) })
    .from(schema.categoryGroups)
    .get();
  return db
    .insert(schema.categoryGroups)
    .values({ ...values, sortOrder: (last?.value ?? -1) + 1 })
    .returning({ id: schema.categoryGroups.id })
    .get().id;
}

export function saveCategory(db: AppDb, input: CategoryInput): number {
  const values = { groupId: input.groupId, name: input.name.trim(), icon: input.icon };

  if (input.id !== undefined) {
    db.update(schema.categories).set(values).where(eq(schema.categories.id, input.id)).run();
    return input.id;
  }

  const last = db
    .select({ value: max(schema.categories.sortOrder) })
    .from(schema.categories)
    .where(eq(schema.categories.groupId, input.groupId))
    .get();
  return db
    .insert(schema.categories)
    .values({ ...values, sortOrder: (last?.value ?? -1) + 1 })
    .returning({ id: schema.categories.id })
    .get().id;
}

export function setGroupArchived(db: AppDb, id: number, archived: boolean): void {
  db.update(schema.categoryGroups).set({ archived }).where(eq(schema.categoryGroups.id, id)).run();
}

export function setCategoryArchived(db: AppDb, id: number, archived: boolean): void {
  db.update(schema.categories).set({ archived }).where(eq(schema.categories.id, id)).run();
}

export function countCategoryTransactions(db: AppDb, id: number): number {
  const row = db
    .select({ value: count() })
    .from(schema.transactions)
    .where(eq(schema.transactions.categoryId, id))
    .get();
  return row?.value ?? 0;
}

/** Categories used by transactions are archived instead; returns false when deletion was refused. */
export function deleteCategory(db: AppDb, id: number): boolean {
  if (countCategoryTransactions(db, id) > 0) return false;
  db.delete(schema.categories).where(eq(schema.categories.id, id)).run();
  return true;
}

/** A group can only be deleted once it has no categories left, archived ones included. */
export function deleteGroup(db: AppDb, id: number): boolean {
  const row = db
    .select({ value: count() })
    .from(schema.categories)
    .where(eq(schema.categories.groupId, id))
    .get();
  if ((row?.value ?? 0) > 0) return false;
  db.delete(schema.categoryGroups).where(eq(schema.categoryGroups.id, id)).run();
  return true;
}
