/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '@/core/db/schema';
import { migrations } from '@/core/db/migrations';
import { confirmLoanPayment, unlinkLoanPayment } from './paymentLinks';
import {
  createCashioBackup,
  parseCashioBackup,
  restoreCashioBackup,
} from '@/features/backup/data/backup';
import { exportReceipt, importReceipt } from '@/features/receipts/data/files';
import { loadReceipt, saveReceipt } from '@/features/receipts/data/repo';
import { files, resetFiles, syntheticJpeg } from '@/features/receipts/testing/fileSystem';
import { CALENDAR_STATE_KEY } from '@/features/calendar/domain/state';

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => jest.requireActual('@/features/receipts/testing/fileSystem'));

const dueAt = new Date(2026, 9, 10).getTime();
const installments = [
  {
    dueAt,
    paymentMinor: 100000,
    principalMinor: 80000,
    interestMinor: 20000,
    insuranceMinor: 1000,
    balanceMinor: 500000,
  },
];
const stored = JSON.stringify({ includeInsurance: true, remindersEnabled: false, installments });

function fixture() {
  const native = new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys = ON');
  migrations.forEach((migration, index) => {
    if (index === 5) native.exec('PRAGMA foreign_keys = OFF');
    native.exec(migration);
    if (index === 5) native.exec('PRAGMA foreign_keys = ON');
  });
  native.exec(`PRAGMA user_version = ${migrations.length}`);
  const execute = (query: string, params: SQLInputValue[], arrays = false) => {
    const statement = native.prepare(query);
    statement.setReturnArrays(arrays);
    const returning = statement.columns().length > 0;
    const rows = returning ? statement.all(...params) : [];
    const result = returning ? { changes: 0, lastInsertRowid: 0 } : statement.run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
      getAllSync: () => rows,
      getFirstSync: () => rows[0] ?? null,
    };
  };
  const client = {
    prepareSync: (query: string) => ({
      executeSync: (params: SQLInputValue[]) => execute(query, params),
      executeForRawResultSync: (params: SQLInputValue[]) => execute(query, params, true),
    }),
    execAsync: async (query: string) => {
      native.exec(query);
    },
    getFirstAsync: async (query: string, params: SQLInputValue[] = []) =>
      native.prepare(query).get(...params),
    getAllAsync: async (query: string, params: SQLInputValue[] = []) =>
      native.prepare(query).all(...params),
    runAsync: async (query: string, params: SQLInputValue[]) =>
      native.prepare(query).run(...params),
    withExclusiveTransactionAsync: async (
      operation: (transaction: SQLiteDatabase) => Promise<void>,
    ) => {
      native.exec('BEGIN');
      try {
        await operation(client);
        native.exec('COMMIT');
      } catch (error) {
        native.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
  const db = drizzle(client, { schema });
  db.insert(schema.accounts)
    .values({
      id: 1,
      name: 'Bank',
      type: 'bank',
      currency: 'RON',
      color: '#000',
      icon: 'wallet',
      createdAt: 1,
    })
    .run();
  db.insert(schema.loanSchedules)
    .values(
      [1, 2].map((id) => ({
        id,
        name: `Loan ${id}`,
        currency: 'RON',
        installmentsJson: stored,
        createdAt: 1,
      })),
    )
    .run();
  db.insert(schema.transactions)
    .values(
      [1, 2].map((id) => ({
        id,
        accountId: 1,
        type: 'expense' as const,
        amountMinor: 99000,
        currency: 'RON',
        status: 'confirmed' as const,
        source: 'manual' as const,
        occurredAt: dueAt,
        createdAt: 1,
        updatedAt: 1,
      })),
    )
    .run();
  return { db, native, client };
}

describe('explicit loan payment associations on real SQLite', () => {
  let context: ReturnType<typeof fixture>;
  beforeEach(() => {
    resetFiles();
    context = fixture();
  });
  afterEach(() => {
    context.native.close();
  });

  it('only writes a link on confirmation, allowing a deliberate amount difference', () => {
    const { db } = context;
    expect(db.select().from(schema.loanPaymentLinks).all()).toEqual([]);
    const transactions = db.select().from(schema.transactions).all();
    confirmLoanPayment(db, 1, dueAt, 1);
    expect(db.select().from(schema.loanPaymentLinks).get()).toMatchObject({
      scheduleId: 1,
      dueAt,
      transactionId: 1,
    });
    expect(db.select().from(schema.transactions).all()).toEqual(transactions);
    expect(db.select().from(schema.loanSchedules).get()!.installmentsJson).toBe(stored);
  });

  it('prevents reuse of a transaction or installment and rolls back failed confirmations', () => {
    const { db } = context;
    confirmLoanPayment(db, 1, dueAt, 1);
    expect(() => confirmLoanPayment(db, 2, dueAt, 1)).toThrow();
    expect(() => confirmLoanPayment(db, 1, dueAt, 2)).toThrow();
    expect(db.select().from(schema.loanPaymentLinks).all()).toHaveLength(1);
    unlinkLoanPayment(db, 1, dueAt);
    confirmLoanPayment(db, 2, dueAt, 1);
    expect(db.select().from(schema.loanPaymentLinks).get()!.scheduleId).toBe(2);
  });

  it.each([
    { status: 'draft' as const },
    { type: 'income' as const },
    { currency: 'EUR' },
    { occurredAt: Date.now() + 86400000 },
  ])('rejects invalid payment state without writing (%j)', (change) => {
    const { db } = context;
    db.update(schema.transactions).set(change).where(eq(schema.transactions.id, 1)).run();
    expect(() => confirmLoanPayment(db, 1, dueAt, 1)).toThrow('Invalid');
    expect(db.select().from(schema.loanPaymentLinks).all()).toEqual([]);
  });

  it('rejects missing schedules, installments or transactions', () => {
    const { db } = context;
    expect(() => confirmLoanPayment(db, 99, dueAt, 1)).toThrow();
    expect(() => confirmLoanPayment(db, 1, dueAt + 1, 1)).toThrow();
    expect(() => confirmLoanPayment(db, 1, dueAt, 99)).toThrow();
  });

  it('cascades links on transaction or schedule deletion, never the transaction on unlink', () => {
    const { db } = context;
    confirmLoanPayment(db, 1, dueAt, 1);
    confirmLoanPayment(db, 2, dueAt, 2);
    db.delete(schema.transactions).where(eq(schema.transactions.id, 1)).run();
    expect(db.select().from(schema.loanPaymentLinks).all()).toHaveLength(1);
    db.delete(schema.loanSchedules).where(eq(schema.loanSchedules.id, 2)).run();
    expect(db.select().from(schema.loanPaymentLinks).all()).toEqual([]);
    expect(db.select().from(schema.transactions).all()).toHaveLength(1);
  });

  it('roundtrips exact associations, individual installments, receipts and local calendar ownership', async () => {
    const { db, client } = context;
    confirmLoanPayment(db, 1, dueAt, 1);
    files.set('file:///picker/synthetic.jpg', syntheticJpeg);
    const image = importReceipt('file:///picker/synthetic.jpg');
    saveReceipt(db, 1, image);
    db.insert(schema.appSettings).values({ key: CALENDAR_STATE_KEY, value: 'local-owner' }).run();
    const backup = await createCashioBackup(client);
    expect(backup.version).toBe(5);
    expect(backup.tables.loan_payment_links).toEqual([
      { id: 1, schedule_id: 1, due_at: dueAt, transaction_id: 1 },
    ]);
    expect(backup.tables.app_settings).toEqual([]);
    unlinkLoanPayment(db, 1, dueAt);
    await restoreCashioBackup(client, parseCashioBackup(JSON.stringify(backup)));
    expect((await createCashioBackup(client)).tables).toEqual(backup.tables);
    expect(loadReceipt(db, 1)).not.toBe(image);
    expect(exportReceipt(loadReceipt(db, 1)!)).toBe(syntheticJpeg.toString('base64'));
    expect(db.select().from(schema.appSettings).get()!.value).toBe('local-owner');
  });

  it.each([1, 2, 3, 4] as const)(
    'restores legacy version %i without inventing or retaining links',
    async (version) => {
      const { db, client } = context;
      confirmLoanPayment(db, 1, dueAt, 1);
      const backup = await createCashioBackup(client);
      const { loan_payment_links: _links, ...tables } = backup.tables;
      const { receipts: _receipts, ...legacy } = backup;
      const parsed = parseCashioBackup(
        JSON.stringify({
          ...legacy,
          version,
          tables,
          ...(version === 4 ? { receipts: [] } : {}),
        }),
      );
      expect(parsed.tables.loan_payment_links).toEqual([]);
      await restoreCashioBackup(client, parsed);
      expect(db.select().from(schema.loanPaymentLinks).all()).toEqual([]);
      expect(db.select().from(schema.transactions).all()).toHaveLength(2);
      expect(db.select().from(schema.loanSchedules).all()).toHaveLength(2);
    },
  );

  it.each([
    'missing-schedule',
    'missing-payment',
    'wrong-currency',
    'wrong-type',
    'draft',
    'invalid-due',
    'duplicate-id',
    'duplicate-payment',
    'duplicate-installment',
    'future-payment',
    'wrong-recurrence',
    'invalid-amount',
    'unknown-column',
    'missing-table',
    'legacy-with-links',
  ])('rejects invalid portable associations without replacing local data (%s)', async (failure) => {
    const { db, client } = context;
    confirmLoanPayment(db, 1, dueAt, 1);
    const before = await createCashioBackup(client);
    const backup = JSON.parse(JSON.stringify(before));
    const row = backup.tables.loan_payment_links[0];
    if (failure === 'missing-schedule') row.schedule_id = 99;
    if (failure === 'missing-payment') row.transaction_id = 99;
    if (failure === 'wrong-currency') backup.tables.transactions[0].currency = 'EUR';
    if (failure === 'wrong-type') backup.tables.transactions[0].type = 'income';
    if (failure === 'draft') backup.tables.transactions[0].status = 'draft';
    if (failure === 'invalid-due') row.due_at += 1;
    if (failure === 'duplicate-id')
      backup.tables.loan_payment_links.push({ ...row, schedule_id: 2, transaction_id: 2 });
    if (failure === 'duplicate-payment')
      backup.tables.loan_payment_links.push({ ...row, id: 2, schedule_id: 2 });
    if (failure === 'duplicate-installment')
      backup.tables.loan_payment_links.push({ ...row, id: 2, transaction_id: 2 });
    if (failure === 'future-payment')
      backup.tables.transactions[0].occurred_at = backup.createdAt + 1;
    if (failure === 'wrong-recurrence') backup.tables.transactions[0].recurring_id = 99;
    if (failure === 'invalid-amount') backup.tables.transactions[0].amount_minor = 0;
    if (failure === 'unknown-column') row.unrecognized = 1;
    if (failure === 'missing-table') delete backup.tables.loan_payment_links;
    if (failure === 'legacy-with-links') backup.version = 4;
    await expect(restoreCashioBackup(client, backup)).rejects.toThrow();
    expect((await createCashioBackup(client)).tables).toEqual(before.tables);
  });

  it('rolls back associations and all other data when a later restore insert fails', async () => {
    const { db, client, native } = context;
    confirmLoanPayment(db, 1, dueAt, 1);
    const before = await createCashioBackup(client);
    const invalid = JSON.parse(JSON.stringify(before));
    invalid.tables.exchange_rates.push({ currency: 'EUR', rate_to_base: null, effective_at: 1 });
    await expect(restoreCashioBackup(client, invalid)).rejects.toThrow();
    expect((await createCashioBackup(client)).tables).toEqual(before.tables);
    expect(native.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
