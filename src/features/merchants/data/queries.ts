import { asc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { schema, useDb } from '@/core/db';

import type { Merchant } from './merchantsRepo';

export function useMerchants(): Merchant[] {
  const db = useDb();
  const { data } = useLiveQuery(db.select().from(schema.merchants).orderBy(asc(schema.merchants.name)));
  return data;
}
