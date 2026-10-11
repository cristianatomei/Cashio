import { count, eq, max, or } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';

export type Account = typeof schema.accounts.$inferSelect;

export type AccountInput = {
  id?: number;
  name: string;
  type: Account['type'];
  currency: string;
  color: string;
  icon: string;
  openingBalanceMinor: number;
};

export function saveAccount(db: AppDb, input: AccountInput): number {
  const values = {
    name: input.name.trim(),
    type: input.type,
    currency: input.currency.trim().toUpperCase(),
    color: input.color,
    icon: input.icon,
    openingBalanceMinor: input.openingBalanceMinor,
  };

  if (input.id !== undefined) {
    db.update(schema.accounts).set(values).where(eq(schema.accounts.id, input.id)).run();
    return input.id;
  }

  const last = db.select({ value: max(schema.accounts.sortOrder) }).from(schema.accounts).get();
  return db
    .insert(schema.accounts)
    .values({ ...values, sortOrder: (last?.value ?? -1) + 1, createdAt: Date.now() })
    .returning({ id: schema.accounts.id })
    .get().id;
}

export function setAccountArchived(db: AppDb, id: number, archived: boolean): void {
  db.update(schema.accounts).set({ archived }).where(eq(schema.accounts.id, id)).run();
}

export function countAccountTransactions(db: AppDb, id: number): number {
  const row = db
    .select({ value: count() })
    .from(schema.transactions)
    .where(or(eq(schema.transactions.accountId, id), eq(schema.transactions.transferAccountId, id)))
    .get();
  return row?.value ?? 0;
}

/** Accounts with history are archived instead; returns false when deletion was refused. */
export function deleteAccount(db: AppDb, id: number): boolean {
  if (countAccountTransactions(db, id) > 0) return false;
  db.delete(schema.accounts).where(eq(schema.accounts.id, id)).run();
  return true;
}
