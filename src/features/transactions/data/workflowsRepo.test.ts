/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import type { SQLiteDatabase } from 'expo-sqlite';

import * as schema from '@/core/db/schema';
import { migrate, migrations } from '@/core/db/migrations';
import {
  createCashioBackup,
  parseCashioBackup,
  restoreCashioBackup,
} from '@/features/backup/data/backup';
import { processRawNotifications } from '@/features/capture/data/pipeline';

import {
  applyAssociation,
  applyBatch,
  saveFilter,
  saveMerchantRule,
  undoBatch,
} from './workflowsRepo';
import { saveTransaction } from './transactionsRepo';

jest.mock('expo-sqlite', () => ({ addDatabaseChangeListener: jest.fn() }));
jest.mock('@/core/db', () => ({
  schema: jest.requireActual('@/core/db/schema'),
  DEFAULT_CURRENCY: 'RON',
}));
jest.mock('@/features/recurring', () => jest.requireActual('@/features/recurring/domain/forecast'));
jest.mock('@/features/loans', () => ({
  parseStoredLoanSchedule: jest.fn(),
}));

/** Real SQLite behind the exact synchronous Expo calls used by Drizzle. */
function database() {
  const native = new DatabaseSync(':memory:');
  const execute = (query: string, params: SQLInputValue[], arrays = false) => {
    const statement = native.prepare(query);
    statement.setReturnArrays(arrays);
    const rows = statement.columns().length ? statement.all(...params) : [];
    const result = statement.columns().length
      ? { changes: 0, lastInsertRowid: 0 }
      : statement.run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
      getAllSync: () => rows,
      getFirstSync: () => rows[0] ?? null,
    };
  };
  const transaction = async (callback: (db: unknown) => Promise<void>) => {
    native.exec('BEGIN');
    try {
      await callback(client);
      native.exec('COMMIT');
    } catch (error) {
      native.exec('ROLLBACK');
      throw error;
    }
  };
  const client = {
    prepareSync: (query: string) => ({
      executeSync: (params: SQLInputValue[]) => execute(query, params),
      executeForRawResultSync: (params: SQLInputValue[]) => execute(query, params, true),
    }),
    execAsync: async (query: string) => {
      native.exec(query);
    },
    getFirstAsync: async (query: string) => native.prepare(query).get(),
    getAllAsync: async (query: string) => native.prepare(query).all(),
    runAsync: async (query: string, params: SQLInputValue[]) =>
      native.prepare(query).run(...params),
    withExclusiveTransactionAsync: transaction,
    withTransactionAsync: transaction,
  } as unknown as SQLiteDatabase;
  return { native, client, db: drizzle(client, { schema }) };
}

describe('transaction workflows on real SQLite', () => {
  let connection: ReturnType<typeof database>;
  beforeEach(async () => {
    connection = database();
    await migrate(connection.client);
    const { db } = connection;
    db.insert(schema.accounts)
      .values({
        id: 1,
        name: 'ING',
        type: 'bank',
        currency: 'RON',
        color: '#000',
        icon: 'wallet',
        createdAt: 1,
      })
      .run();
    db.insert(schema.categoryGroups)
      .values({ id: 1, name: 'Expenses', kind: 'expense', color: '#000', icon: 'wallet' })
      .run();
    db.insert(schema.categories)
      .values([
        { id: 1, groupId: 1, name: 'Food', icon: 'cart' },
        { id: 2, groupId: 1, name: 'Other', icon: 'cart' },
      ])
      .run();
    db.insert(schema.merchants).values({ id: 1, name: 'Mega', defaultCategoryId: 1 }).run();
    db.insert(schema.tags).values({ id: 1, name: 'test' }).run();
    db.insert(schema.rawNotifications)
      .values({ id: 1, packageName: 'com.ing.mobile.banking', body: 'test', postedAt: 100 })
      .run();
    db.insert(schema.transactions)
      .values({
        id: 1,
        type: 'expense',
        amountMinor: 1200,
        currency: 'RON',
        merchantId: 1,
        categoryId: 1,
        accountId: 1,
        status: 'draft',
        source: 'notification',
        rawNotificationId: 1,
        occurredAt: 100,
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    db.insert(schema.transactionTags).values({ transactionId: 1, tagId: 1 }).run();
    db.insert(schema.transactionAllocations)
      .values({ id: 7, transactionId: 1, categoryId: 1, amountMinor: 1200 })
      .run();
  });
  afterEach(() => connection.native.close());

  it('deletes and restores exact rows, tags, allocations, raw state and loan links atomically', () => {
    const { db, native } = connection;
    // Matches the optional planning feature's additive relation.
    native.exec(
      'CREATE TABLE loan_payment_links (id INTEGER PRIMARY KEY, schedule_id INTEGER NOT NULL, due_at INTEGER NOT NULL, transaction_id INTEGER UNIQUE REFERENCES transactions(id) ON DELETE CASCADE, UNIQUE(schedule_id,due_at)); INSERT INTO loan_payment_links VALUES (9,3,100,1);',
    );
    const before = db.select().from(schema.transactions).all();
    const undo = applyBatch(db, [1, 1], { kind: 'delete' });
    expect(db.select().from(schema.transactions).all()).toEqual([]);
    expect(db.select().from(schema.transactionTags).all()).toEqual([]);
    expect(db.select().from(schema.rawNotifications).get()?.reviewStatus).toBe('ignored');
    undoBatch(db, undo);
    expect(db.select().from(schema.transactions).all()).toEqual(before);
    expect(db.select().from(schema.transactionTags).all()).toEqual([
      { transactionId: 1, tagId: 1 },
    ]);
    expect(db.select().from(schema.transactionAllocations).get()).toMatchObject({
      id: 7,
      categoryId: 1,
      amountMinor: 1200,
    });
    expect(db.select().from(schema.rawNotifications).get()?.reviewStatus).toBe('open');
    expect(native.prepare('SELECT * FROM loan_payment_links').get()).toEqual({
      id: 9,
      schedule_id: 3,
      due_at: 100,
      transaction_id: 1,
    });
  });

  it('confirms with recurring match and restores recurring due state on undo', () => {
    const { db } = connection;
    db.insert(schema.recurringRules)
      .values({
        id: 1,
        accountId: 1,
        type: 'expense',
        amountMinor: 1200,
        currency: 'RON',
        categoryId: 1,
        merchantId: 1,
        frequency: 'monthly',
        nextDue: 100,
        createdAt: 1,
      })
      .run();
    const undo = applyBatch(db, [1], { kind: 'confirm' });
    expect(db.select().from(schema.transactions).get()).toMatchObject({
      status: 'confirmed',
      recurringId: 1,
    });
    expect(db.select().from(schema.recurringRules).get()?.nextDue).not.toBe(100);
    undoBatch(db, undo);
    expect(db.select().from(schema.transactions).get()).toMatchObject({
      status: 'draft',
      recurringId: null,
    });
    expect(db.select().from(schema.recurringRules).get()?.nextDue).toBe(100);
  });

  it('undoes merchant assignment including aliases, learned rules and merchant defaults', () => {
    const { db } = connection;
    db.update(schema.transactions).set({ merchantId: null, merchantRaw: 'MEGA SRL' }).run();
    db.update(schema.merchants).set({ defaultCategoryId: null }).run();
    const undo = applyAssociation(db, [1], {
      merchantRaw: 'MEGA SRL',
      merchantId: 1,
      categoryId: 2,
      remember: true,
    });
    expect(db.select().from(schema.transactions).get()).toMatchObject({
      merchantId: 1,
      status: 'confirmed',
      categoryId: 2,
    });
    expect(db.select().from(schema.merchantAliases).all()).toHaveLength(1);
    expect(db.select().from(schema.merchantCategoryRules).all()).toHaveLength(1);
    undoBatch(db, undo);
    expect(db.select().from(schema.transactions).get()).toMatchObject({
      merchantId: null,
      status: 'draft',
      categoryId: 1,
    });
    expect(db.select().from(schema.merchantAliases).all()).toHaveLength(0);
    expect(db.select().from(schema.merchantCategoryRules).all()).toHaveLength(0);
    expect(db.select().from(schema.merchants).get()?.defaultCategoryId).toBeNull();
  });

  it('rolls back all rows for incomplete confirmation or incompatible category/account edits', () => {
    const { db } = connection;
    db.insert(schema.transactions)
      .values({
        id: 2,
        type: 'expense',
        amountMinor: 500,
        currency: 'RON',
        status: 'draft',
        source: 'manual',
        occurredAt: 100,
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    expect(() => applyBatch(db, [1, 2], { kind: 'confirm' })).toThrow();
    expect(
      db
        .select()
        .from(schema.transactions)
        .all()
        .every((row) => row.status === 'draft'),
    ).toBe(true);
    db.insert(schema.accounts)
      .values({
        id: 2,
        name: 'EUR',
        type: 'bank',
        currency: 'EUR',
        color: '#000',
        icon: 'wallet',
        createdAt: 1,
      })
      .run();
    expect(() => applyBatch(db, [1], { kind: 'account', accountId: 2 })).toThrow();
    db.insert(schema.transactionAllocations)
      .values({ transactionId: 1, categoryId: 2, amountMinor: 100 })
      .run();
    expect(() => applyBatch(db, [1], { kind: 'category', categoryId: 2 })).toThrow('split');
    expect(db.select().from(schema.transactions).get()?.categoryId).toBe(1);
  });

  it('refuses stale undo and retains newer edits', () => {
    const { db } = connection;
    const undo = applyBatch(db, [1], { kind: 'category', categoryId: 2 });
    db.update(schema.transactions)
      .set({ note: 'newer edit' })
      .where(eq(schema.transactions.id, 1))
      .run();
    expect(() => undoBatch(db, undo)).toThrow('changed');
    expect(db.select().from(schema.transactions).get()?.note).toBe('newer edit');
  });

  it('adds tags without removing existing links, and undoes accurately', () => {
    const { db } = connection;
    db.insert(schema.tags).values({ id: 2, name: 'new' }).run();
    const undo = applyBatch(db, [1], { kind: 'tags', tagIds: [1, 2, 2] });
    expect(db.select().from(schema.transactionTags).all()).toHaveLength(2);
    undoBatch(db, undo);
    expect(db.select().from(schema.transactionTags).all()).toEqual([
      { transactionId: 1, tagId: 1 },
    ]);
  });

  it('learns future classification without touching history unless explicitly opted in', () => {
    const { db } = connection;
    saveMerchantRule(db, 1, 'expense', 2, false);
    expect(db.select().from(schema.transactions).get()?.categoryId).toBe(1);
    db.insert(schema.rawNotifications)
      .values({
        packageName: 'com.ing.mobile.banking',
        title: 'ING',
        body: 'Ai platit 12,00 RON la MEGA',
        postedAt: 1_700_000_000_000,
      })
      .run();
    processRawNotifications(db, 'ro');
    expect(
      db
        .select()
        .from(schema.transactions)
        .all()
        .find((row) => row.id !== 1),
    ).toMatchObject({ categoryId: 2, merchantId: 1, status: 'confirmed' });
    saveMerchantRule(db, 1, 'expense', 2, true);
    expect(
      db.select().from(schema.transactions).where(eq(schema.transactions.id, 1)).get(),
    ).toMatchObject({ categoryId: 2, status: 'draft' });
  });

  it('roundtrips durable rules and saved views, rejecting unsupported backup before deletion', async () => {
    const { db, client } = connection;
    saveMerchantRule(db, 1, 'expense', 2, false);
    saveFilter(db, 'Food', {
      query: 'mega',
      type: 'expense',
      categoryId: 2,
      tagId: 1,
      from: '2026-10-01',
      to: '2026-10-28',
    });
    const backup = parseCashioBackup(JSON.stringify(await createCashioBackup(client)));
    db.delete(schema.merchantCategoryRules).run();
    db.delete(schema.savedTransactionFilters).run();
    await restoreCashioBackup(client, backup);
    expect(db.select().from(schema.merchantCategoryRules).get()).toMatchObject({
      merchantId: 1,
      categoryId: 2,
    });
    expect(db.select().from(schema.savedTransactionFilters).get()?.name).toBe('Food');
    await expect(restoreCashioBackup(client, { ...backup, schemaVersion: 999 })).rejects.toThrow(
      'incompatible',
    );
    expect(db.select().from(schema.transactions).all()).toHaveLength(1);
    expect(() =>
      parseCashioBackup(
        JSON.stringify({
          ...backup,
          tables: {
            ...backup.tables,
            saved_transaction_filters: [
              { id: 1, created_at: 1, name: 'Bad', filter_json: '{"type":"oops"}' },
            ],
          },
        }),
      ),
    ).toThrow('Invalid filter');
  });

  it('does not silently edit a transaction that was removed while its form was open', () => {
    const { db } = connection;
    db.delete(schema.transactions).run();
    expect(() =>
      saveTransaction(db, {
        id: 1,
        type: 'expense',
        accountId: 1,
        transferAccountId: null,
        amountMinor: 100,
        currency: 'RON',
        categoryId: 1,
        merchantId: 1,
        note: null,
        tagIds: [],
        occurredAt: 100,
      }),
    ).toThrow('no longer exists');
  });

  it('blocks incompatible edits of explicitly linked loan payments', () => {
    const { db, native } = connection;
    db.insert(schema.loanSchedules)
      .values({ id: 1, name: 'Loan', currency: 'RON', installmentsJson: '[]', createdAt: 1 })
      .run();
    native.exec(
      'CREATE TABLE loan_payment_links (id INTEGER PRIMARY KEY, schedule_id INTEGER NOT NULL REFERENCES loan_schedules(id), due_at INTEGER NOT NULL, transaction_id INTEGER UNIQUE REFERENCES transactions(id) ON DELETE CASCADE); INSERT INTO loan_payment_links VALUES (1,1,100,1);',
    );
    const input = {
      id: 1,
      type: 'income' as const,
      accountId: 1,
      transferAccountId: null,
      amountMinor: 1200,
      currency: 'RON',
      categoryId: 1,
      merchantId: 1,
      note: null,
      tagIds: [],
      occurredAt: 100,
    };
    expect(() => saveTransaction(db, input)).toThrow('Unlink');
    expect(db.select().from(schema.transactions).get()?.type).toBe('expense');
    expect(() => saveTransaction(db, { ...input, type: 'expense', currency: 'EUR' })).toThrow(
      'Unlink',
    );
    expect(() =>
      saveTransaction(db, { ...input, type: 'expense', occurredAt: Date.now() + 86400000 }),
    ).toThrow('Unlink');
    db.insert(schema.recurringRules)
      .values({
        id: 2,
        accountId: 1,
        type: 'expense',
        amountMinor: 1200,
        currency: 'RON',
        categoryId: 1,
        merchantId: 1,
        frequency: 'monthly',
        nextDue: 100,
        createdAt: 1,
      })
      .run();
    expect(() => saveTransaction(db, { ...input, type: 'expense' })).toThrow('another recurring');
  });

  it('upgrades a populated previous schema without touching existing transactions', async () => {
    const previous = database();
    try {
      for (const migration of migrations.slice(0, -1)) previous.native.exec(migration);
      previous.native.exec(`PRAGMA user_version = ${migrations.length - 1};`);
      previous.db
        .insert(schema.transactions)
        .values({
          id: 8,
          type: 'expense',
          amountMinor: 123,
          currency: 'RON',
          status: 'draft',
          source: 'manual',
          occurredAt: 100,
          createdAt: 1,
          updatedAt: 1,
        })
        .run();
      const before = previous.db.select().from(schema.transactions).all();
      await migrate(previous.client);
      expect(previous.db.select().from(schema.transactions).all()).toEqual(before);
      expect(previous.db.select().from(schema.merchantCategoryRules).all()).toEqual([]);
      expect(previous.db.select().from(schema.savedTransactionFilters).all()).toEqual([]);
      expect(previous.native.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      previous.native.close();
    }
  });
});
