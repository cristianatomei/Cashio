import { eq } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';

export type Merchant = typeof schema.merchants.$inferSelect;

export type MerchantInput = {
  id?: number;
  name: string;
  defaultCategoryId: number | null;
};

/** Throws on a duplicate name (names are unique). */
export function saveMerchant(db: AppDb, input: MerchantInput): number {
  const values = { name: input.name.trim(), defaultCategoryId: input.defaultCategoryId };

  if (input.id !== undefined) {
    db.update(schema.merchants).set(values).where(eq(schema.merchants.id, input.id)).run();
    return input.id;
  }
  return db
    .insert(schema.merchants)
    .values(values)
    .returning({ id: schema.merchants.id })
    .get().id;
}

export function findOrCreateMerchant(db: AppDb, name: string): number {
  const trimmed = name.trim();
  const existing = db
    .select({ id: schema.merchants.id })
    .from(schema.merchants)
    .where(eq(schema.merchants.name, trimmed))
    .get();
  return existing?.id ?? saveMerchant(db, { name: trimmed, defaultCategoryId: null });
}

/** Transactions keep their data; they only lose the link to the merchant. */
export function deleteMerchant(db: AppDb, id: number): void {
  db.delete(schema.merchants).where(eq(schema.merchants.id, id)).run();
}
