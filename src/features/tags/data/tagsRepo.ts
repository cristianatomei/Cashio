import { eq } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';

export type Tag = typeof schema.tags.$inferSelect;

export type TagInput = { id?: number; name: string; color: string | null };

/** Throws on a duplicate name (names are unique). */
export function saveTag(db: AppDb, input: TagInput): number {
  const values = { name: input.name.trim(), color: input.color };

  if (input.id !== undefined) {
    db.update(schema.tags).set(values).where(eq(schema.tags.id, input.id)).run();
    return input.id;
  }
  return db.insert(schema.tags).values(values).returning({ id: schema.tags.id }).get().id;
}

export function findOrCreateTag(db: AppDb, name: string): number {
  const trimmed = name.trim();
  const existing = db
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .where(eq(schema.tags.name, trimmed))
    .get();
  return existing?.id ?? saveTag(db, { name: trimmed, color: null });
}

/** Removes the tag from every transaction as well. */
export function deleteTag(db: AppDb, id: number): void {
  db.delete(schema.tags).where(eq(schema.tags.id, id)).run();
}
