/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import * as schema from '@/core/db/schema';
import { migrate, migrations } from '@/core/db/migrations';
import {
  createCashioBackup,
  parseCashioBackup,
  restoreCashioBackup,
} from '@/features/backup/data/backup';
import { deleteGoal, saveGoal, saveValuation } from './repo';

jest.mock('expo-sqlite', () => ({}));

// Real SQLite in memory, exposing only the Expo methods used by migrations/repos/backup.
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    getFirstAsync: async (sql: string) => sqlite.prepare(sql).get(),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
    runAsync: async (sql: string, values: SQLInputValue[]) => sqlite.prepare(sql).run(...values),
    prepareSync: (sql: string) => ({
      executeSync: (values: SQLInputValue[]) => {
        const result = sqlite.prepare(sql).run(...values);
        return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
      },
      executeForRawResultSync: (values: SQLInputValue[]) => ({
        getAllSync: () => {
          const stmt = sqlite.prepare(sql);
          stmt.setReturnArrays(true);
          return stmt.all(...values);
        },
      }),
    }),
    withExclusiveTransactionAsync: async (callback: (tx: SQLiteDatabase) => Promise<void>) => {
      sqlite.exec('BEGIN');
      try {
        await callback(adapter as unknown as SQLiteDatabase);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    withTransactionAsync: async (callback: () => Promise<void>) =>
      adapter.withExclusiveTransactionAsync(callback),
  };
  const expo = adapter as unknown as SQLiteDatabase;
  return { sqlite, expo, db: drizzle(expo, { schema }) };
}

describe('planning migration, local persistence and backup restore', () => {
  let context: ReturnType<typeof fixture>;
  beforeEach(() => {
    context = fixture();
  });
  afterEach(() => {
    context.sqlite.close();
  });
  const goal = {
    name: ' Synthetic goal ',
    currency: 'RON',
    targetMinor: 10000,
    currentMinor: 2500,
  };
  const valuation = {
    assetId: 'synthetic-asset',
    currency: 'EUR',
    amountMinor: 12000,
    valuedAt: 1,
  };

  it('upgrades the previous schema without changing existing rows and is idempotent', async () => {
    for (const migration of migrations.slice(0, -1)) context.sqlite.exec(migration);
    context.sqlite.exec(`PRAGMA user_version = ${migrations.length - 1}`);
    context.sqlite.exec("INSERT INTO app_settings VALUES ('synthetic-setting', 'preserved')");
    await migrate(context.expo);
    await migrate(context.expo);
    expect(
      context.sqlite.prepare("SELECT value FROM app_settings WHERE key = 'synthetic-setting'").get()
        ?.value,
    ).toBe('preserved');
    expect(context.sqlite.prepare('PRAGMA user_version').get()?.user_version).toBe(
      migrations.length,
    );
    expect(context.db.select().from(schema.savingsGoals).all()).toEqual([]);
    expect(context.db.select().from(schema.investmentValuations).all()).toEqual([]);
  });

  it('creates, edits and deletes a goal without creating transactions', async () => {
    await migrate(context.expo);
    saveGoal(context.db, goal);
    const saved = context.db.select().from(schema.savingsGoals).get()!;
    expect(saved).toMatchObject({ ...goal, name: goal.name.trim() });
    saveGoal(context.db, { ...goal, currentMinor: 15000 }, saved.id);
    expect(context.db.select().from(schema.savingsGoals).get()?.currentMinor).toBe(15000);
    expect(context.db.select().from(schema.transactions).all()).toEqual([]);
    deleteGoal(context.db, saved.id);
    expect(context.db.select().from(schema.savingsGoals).all()).toEqual([]);
  });

  it('upserts explicit investment valuations and rejects unsafe/future inputs', async () => {
    await migrate(context.expo);
    saveValuation(context.db, valuation);
    saveValuation(context.db, { ...valuation, amountMinor: 0 });
    expect(context.db.select().from(schema.investmentValuations).all()).toEqual([
      { ...valuation, amountMinor: 0 },
    ]);
    expect(() =>
      saveValuation(context.db, { ...valuation, valuedAt: Date.now() + 100000 }),
    ).toThrow('future');
    expect(() => saveGoal(context.db, { ...goal, targetMinor: 0 })).toThrow('Invalid savings goal');
  });

  it('exports, validates and restores goals, valuations and their tracked asset identities', async () => {
    await migrate(context.expo);
    saveGoal(context.db, goal);
    saveValuation(context.db, valuation);
    context.db
      .insert(schema.appSettings)
      .values({
        key: 'investment_assets',
        value: JSON.stringify([
          { id: valuation.assetId, name: 'Synthetic asset', symbol: 'SYN', kind: 'stock' },
        ]),
      })
      .run();
    const backup = parseCashioBackup(JSON.stringify(await createCashioBackup(context.expo)));
    expect(backup.version).toBe(3);
    expect(backup.tables.savings_goals[0]).toMatchObject({
      name: 'Synthetic goal',
      current_minor: 2500,
    });
    expect(backup.tables.investment_valuations).toEqual([
      { asset_id: valuation.assetId, amount_minor: 12000, currency: 'EUR', valued_at: 1 },
    ]);
    context.sqlite.exec(
      'DELETE FROM savings_goals; DELETE FROM investment_valuations; DELETE FROM app_settings',
    );
    await restoreCashioBackup(context.expo, backup);
    expect(await createCashioBackup(context.expo)).toMatchObject({ tables: backup.tables });
  });

  it('accepts pre-planning backups and restores empty planning tables', async () => {
    await migrate(context.expo);
    const old = await createCashioBackup(context.expo);
    const { savings_goals: _goals, investment_valuations: _valuations, ...tables } = old.tables;
    const parsed = parseCashioBackup(
      JSON.stringify({ ...old, version: 2, schemaVersion: 10, tables }),
    );
    saveGoal(context.db, goal);
    saveValuation(context.db, valuation);
    await restoreCashioBackup(context.expo, parsed);
    expect(context.db.select().from(schema.savingsGoals).all()).toEqual([]);
    expect(context.db.select().from(schema.investmentValuations).all()).toEqual([]);
  });

  it('rejects invalid planning backups before they can replace existing data', async () => {
    await migrate(context.expo);
    saveGoal(context.db, goal);
    saveValuation(context.db, valuation);
    const backup = await createCashioBackup(context.expo);
    const invalidGoal = {
      ...backup,
      tables: {
        ...backup.tables,
        savings_goals: [{ ...backup.tables.savings_goals[0], target_minor: 0 }],
      },
    };
    const invalidValue = {
      ...backup,
      tables: {
        ...backup.tables,
        investment_valuations: [{ ...backup.tables.investment_valuations[0], amount_minor: -1 }],
      },
    };
    for (const invalid of [invalidGoal, invalidValue]) {
      expect(() => parseCashioBackup(JSON.stringify(invalid))).toThrow('Invalid');
    }
    expect(context.db.select().from(schema.savingsGoals).all()).toHaveLength(1);
    expect(context.db.select().from(schema.investmentValuations).all()).toHaveLength(1);
  });

  it('rejects incomplete new-format table sets and duplicate planning identifiers', async () => {
    await migrate(context.expo);
    saveGoal(context.db, goal);
    saveValuation(context.db, valuation);
    const backup = await createCashioBackup(context.expo);
    const { savings_goals: _goals, ...incomplete } = backup.tables;
    expect(() => parseCashioBackup(JSON.stringify({ ...backup, tables: incomplete }))).toThrow(
      'expected Cashio tables',
    );
    for (const table of ['savings_goals', 'investment_valuations'] as const) {
      expect(() =>
        parseCashioBackup(
          JSON.stringify({
            ...backup,
            tables: {
              ...backup.tables,
              [table]: [...backup.tables[table], ...backup.tables[table]],
            },
          }),
        ),
      ).toThrow('invalid');
    }
  });

  it('rolls back a failed restore instead of losing durable goals', async () => {
    await migrate(context.expo);
    saveGoal(context.db, goal);
    const backup = await createCashioBackup(context.expo);
    backup.tables.savings_goals[0].target_minor = 0;
    await expect(restoreCashioBackup(context.expo, backup)).rejects.toThrow();
    expect(context.db.select().from(schema.savingsGoals).get()?.targetMinor).toBe(10000);
  });
});
