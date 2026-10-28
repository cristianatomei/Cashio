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
import { deleteTransaction, saveTransaction } from './transactionsRepo';
import { files, failures, resetFiles, syntheticJpeg } from '@/features/receipts/testing/fileSystem';
import { exportReceipt, importReceipt, receiptFile } from '@/features/receipts/data/files';
import { cleanupReceipts, loadReceipt, saveReceipt } from '@/features/receipts/data/repo';

jest.mock('expo-file-system', () => jest.requireActual('@/features/receipts/testing/fileSystem'));

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
    resetFiles();
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

  const attach = (db: ReturnType<typeof database>['db']) => {
    files.set('file:///picker/synthetic.jpg', syntheticJpeg);
    const filename = importReceipt('file:///picker/synthetic.jpg');
    saveReceipt(db, 1, filename);
    return filename;
  };

  it('keeps receipt links through edits/reloads, FK deletion, undo and final cleanup', () => {
    const { db } = connection;
    const filename = attach(db);
    saveTransaction(db, {
      id: 1,
      type: 'expense',
      accountId: 1,
      transferAccountId: null,
      amountMinor: 1300,
      currency: 'RON',
      categoryId: 1,
      merchantId: 1,
      note: 'Synthetic edit',
      tagIds: [],
      occurredAt: 200,
    });
    expect(loadReceipt(db, 1)).toBe(filename);
    expect(() => saveReceipt(db, 999, filename)).toThrow();
    const undo = applyBatch(db, [1], { kind: 'delete' });
    expect(loadReceipt(db, 1)).toBeNull();
    expect(receiptFile(filename).exists).toBe(true);
    undoBatch(db, undo);
    expect(loadReceipt(db, 1)).toBe(filename);
    cleanupReceipts(db, [filename]);
    expect(receiptFile(filename).exists).toBe(true);
    deleteTransaction(db, 1);
    expect(loadReceipt(db, 1)).toBeNull();
    expect(receiptFile(filename).exists).toBe(false);
  });

  it('cleans replacement/removal only after commit, protecting other receipts and rollback', () => {
    const { db } = connection;
    const old = attach(db);
    const replacement = importReceipt('file:///picker/synthetic.jpg');
    expect(() =>
      db.transaction((tx) => {
        saveReceipt(tx, 1, replacement);
        throw new Error('Synthetic database failure');
      }),
    ).toThrow('Synthetic');
    expect(loadReceipt(db, 1)).toBe(old);
    cleanupReceipts(db, [replacement]);
    expect(receiptFile(old).exists).toBe(true);
    expect(receiptFile(replacement).exists).toBe(false);
    saveReceipt(db, 1, null);
    cleanupReceipts(db, [old]);
    expect(receiptFile(old).exists).toBe(false);
  });

  it('never shares a receipt file between transactions or deletes another transaction’s image', () => {
    const { db } = connection;
    const first = attach(db);
    const second = importReceipt('file:///picker/synthetic.jpg');
    const row = db.select().from(schema.transactions).get()!;
    db.insert(schema.transactions)
      .values({ ...row, id: 2, rawNotificationId: null, dedupeHash: null })
      .run();
    saveReceipt(db, 2, second);
    expect(() => saveReceipt(db, 1, second)).toThrow();
    expect(loadReceipt(db, 1)).toBe(first);
    deleteTransaction(db, 1);
    expect(receiptFile(first).exists).toBe(false);
    expect(loadReceipt(db, 2)).toBe(second);
    expect(exportReceipt(second)).toBe(syntheticJpeg.toString('base64'));
  });

  it('roundtrips receipts without local paths, using fresh files and cleaning old files', async () => {
    const { db, client } = connection;
    const old = attach(db);
    const backup = parseCashioBackup(JSON.stringify(await createCashioBackup(client)));
    expect(backup.version).toBe(4);
    expect(backup.receipts).toEqual([
      { transactionId: 1, base64: syntheticJpeg.toString('base64') },
    ]);
    expect(JSON.stringify(backup)).not.toContain('file:///');
    await restoreCashioBackup(client, backup);
    const restored = loadReceipt(db, 1)!;
    expect(restored).not.toBe(old);
    expect(exportReceipt(restored)).toBe(syntheticJpeg.toString('base64'));
    expect(receiptFile(old).exists).toBe(false);
  });

  it('restores legacy backups without leaving receipts attached to reused transaction IDs', async () => {
    const { db, client } = connection;
    const filename = attach(db);
    const { receipts: _receipts, ...backup } = await createCashioBackup(client);
    await restoreCashioBackup(client, { ...backup, version: 3 });
    expect(loadReceipt(db, 1)).toBeNull();
    expect(receiptFile(filename).exists).toBe(false);
  });

  it('aborts backups on missing/unreadable receipts rather than silently dropping images', async () => {
    const { db, client } = connection;
    const filename = attach(db);
    failures.read = true;
    await expect(createCashioBackup(client)).rejects.toThrow('missing');
    failures.read = false;
    receiptFile(filename).delete();
    await expect(createCashioBackup(client)).rejects.toThrow('missing');
    expect(loadReceipt(db, 1)).toBe(filename);
  });

  it('preserves old database/files on staging or database restore failure', async () => {
    const { db, client } = connection;
    const filename = attach(db);
    const backup = await createCashioBackup(client);
    failures.write = true;
    await expect(restoreCashioBackup(client, backup)).rejects.toThrow('saveFailed');
    failures.write = false;
    expect(loadReceipt(db, 1)).toBe(filename);
    expect(receiptFile(filename).exists).toBe(true);
    backup.tables.transactions[0].account_id = 9999;
    await expect(restoreCashioBackup(client, backup)).rejects.toThrow('invalid references');
    expect(loadReceipt(db, 1)).toBe(filename);
    expect(receiptFile(filename).exists).toBe(true);
    expect([...files.keys()].filter((uri) => uri.includes('/receipts/'))).toHaveLength(1);
  });

  it('rejects missing, duplicate and unlinked receipt payloads before changing data', async () => {
    const { db, client } = connection;
    const filename = attach(db);
    const backup = await createCashioBackup(client);
    for (const receipts of [
      undefined,
      [...backup.receipts!, ...backup.receipts!],
      [{ ...backup.receipts![0], transactionId: 999 }],
    ]) {
      await expect(restoreCashioBackup(client, { ...backup, receipts })).rejects.toThrow(
        'invalidBackup',
      );
      expect(loadReceipt(db, 1)).toBe(filename);
      expect(receiptFile(filename).exists).toBe(true);
    }
  });

  it('reports post-delete cleanup failure without undoing referential cleanup, and retries', () => {
    const { db } = connection;
    const filename = attach(db);
    failures.delete = true;
    expect(() => deleteTransaction(db, 1)).toThrow('cleanupFailed');
    expect(loadReceipt(db, 1)).toBeNull();
    failures.delete = false;
    cleanupReceipts(db, [filename]);
    expect(receiptFile(filename).exists).toBe(false);
  });

  it('distinguishes successful restore with cleanup failure from failed restore', async () => {
    const { db, client } = connection;
    const old = attach(db);
    const backup = await createCashioBackup(client);
    failures.delete = true;
    await expect(restoreCashioBackup(client, backup)).rejects.toThrow('restoreCleanupFailed');
    const restored = loadReceipt(db, 1)!;
    expect(restored).not.toBe(old);
    expect(exportReceipt(restored)).toBe(syntheticJpeg.toString('base64'));
    expect(receiptFile(old).exists).toBe(true);
    failures.delete = false;
    cleanupReceipts(db, [old]);
    expect(receiptFile(old).exists).toBe(false);
  });

  it('does not resurrect a stale receipt link through Undo after restore removed its file', async () => {
    const { db, client } = connection;
    const filename = attach(db);
    const undo = applyBatch(db, [1], { kind: 'delete' });
    const backup = await createCashioBackup(client);
    await restoreCashioBackup(client, backup);
    expect(receiptFile(filename).exists).toBe(false);
    expect(() => undoBatch(db, undo)).toThrow('missing');
    expect(db.select().from(schema.transactions).all()).toEqual([]);
    expect(db.select().from(schema.transactionReceipts).all()).toEqual([]);
  });

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
