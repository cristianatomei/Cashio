import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { asc } from 'drizzle-orm';
import { useMemo } from 'react';

import { schema, useDb } from '@/core/db';

import { computeBalances } from '../domain/balances';
import type { Account } from './accountsRepo';

export function useAccounts({ includeArchived = false } = {}): Account[] {
  const db = useDb();
  const { data } = useLiveQuery(
    db.select().from(schema.accounts).orderBy(asc(schema.accounts.sortOrder), asc(schema.accounts.id)),
  );
  return useMemo(
    () => (includeArchived ? data : data.filter((account) => !account.archived)),
    [data, includeArchived],
  );
}

/** Live balance per account id, including archived accounts. */
export function useAccountBalances(): Map<number, number> {
  const db = useDb();
  const { data: accounts } = useLiveQuery(db.select().from(schema.accounts));
  const { data: transactions } = useLiveQuery(
    db
      .select({
        accountId: schema.transactions.accountId,
        type: schema.transactions.type,
        status: schema.transactions.status,
        amountMinor: schema.transactions.amountMinor,
        transferAccountId: schema.transactions.transferAccountId,
        transferAmountMinor: schema.transactions.transferAmountMinor,
      })
      .from(schema.transactions),
  );
  return useMemo(() => computeBalances(accounts, transactions), [accounts, transactions]);
}
