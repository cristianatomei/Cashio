import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import * as schema from './schema';
import { isDisposableTestBuild } from './testBuild';

export const DATABASE_NAME = isDisposableTestBuild ? 'cashio.e2e.synthetic.db' : 'cashio.db';

export { migrate } from './migrations';
export { seedDefaults } from './seed';
export type { Language } from './defaults';
export { DEFAULT_CURRENCY } from './defaults';
export { schema };

export type AppDb = ExpoSQLiteDatabase<typeof schema>;

export function useDb(): AppDb {
  const sqlite = useSQLiteContext();
  return useMemo(() => drizzle(sqlite, { schema }), [sqlite]);
}
