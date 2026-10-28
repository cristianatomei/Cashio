import type { SQLiteDatabase } from 'expo-sqlite';

import { CALENDAR_STATE_KEY } from '@/features/calendar/domain/state';
import { createCashioBackup, restoreCashioBackup } from './backup';

type Row = Record<string, string | number | null>;

function database() {
  const tables = new Map<string, Row[]>([
    [
      'app_settings',
      [
        { key: CALENDAR_STATE_KEY, value: 'local ownership journal' },
        { key: 'language', value: 'en' },
      ],
    ],
  ]);
  const db = {
    getFirstAsync: jest.fn(async (sql: string) =>
      sql.includes('user_version')
        ? { user_version: 12 }
        : tables.get('app_settings')?.find((row) => row.key === CALENDAR_STATE_KEY),
    ),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('table_info')) return [{ name: 'key' }, { name: 'value' }];
      if (sql.includes('foreign_key_check')) return [];
      return [...(tables.get(sql.match(/FROM "([^"]+)"/)![1]) ?? [])];
    }),
    execAsync: jest.fn(async (sql: string) => {
      const table = sql.match(/DELETE FROM "([^"]+)"/)?.[1];
      if (table) tables.set(table, []);
    }),
    runAsync: jest.fn(async (sql: string, values: (string | number | null)[]) => {
      const table = sql.match(/INSERT INTO "?(\w+)"?/)![1];
      const names = sql
        .match(/\(([^)]+)\)/)![1]
        .split(',')
        .map((name) => name.trim().replaceAll('"', ''));
      const row = Object.fromEntries(names.map((name, index) => [name, values[index]]));
      tables.set(table, [...(tables.get(table) ?? []), row]);
    }),
    withExclusiveTransactionAsync: async (operation: (transaction: unknown) => Promise<void>) =>
      operation(db),
  };
  return { db: db as unknown as SQLiteDatabase, tables };
}

it('does not export installation-specific consent or native event/calendar IDs', async () => {
  const { db } = database();
  const backup = await createCashioBackup(db);
  expect(backup.tables.app_settings).toEqual([{ key: 'language', value: 'en' }]);
});

it('ignores imported calendar consent and preserves this installation’s cleanup journal', async () => {
  const { db, tables } = database();
  const backup = await createCashioBackup(db);
  backup.tables.app_settings.push({ key: CALENDAR_STATE_KEY, value: 'foreign ownership journal' });
  backup.tables.app_settings[0].value = 'ro';
  await restoreCashioBackup(db, backup);
  expect(tables.get('app_settings')).toEqual([
    { key: 'language', value: 'ro' },
    { key: CALENDAR_STATE_KEY, value: 'local ownership journal' },
  ]);
});

it('cannot opt in a fresh installation by restoring another installation’s calendar state', async () => {
  const { db, tables } = database();
  const backup = await createCashioBackup(db);
  backup.tables.app_settings.push({ key: CALENDAR_STATE_KEY, value: 'foreign ownership journal' });
  tables.set('app_settings', []);
  await restoreCashioBackup(db, backup);
  expect(tables.get('app_settings')).toEqual([{ key: 'language', value: 'en' }]);
});
