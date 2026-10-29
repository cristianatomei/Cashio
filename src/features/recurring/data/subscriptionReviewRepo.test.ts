/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as schema from '@/core/db/schema';
import { migrate } from '@/core/db/migrations';
import {
  createCashioBackup,
  parseCashioBackup,
  restoreCashioBackup,
} from '@/features/backup/data/backup';
import { expense } from '@/features/stats/domain/fixtures.test-helper';
import { detectSpendingInsights } from '@/features/stats/domain/insights';
import {
  reviewKey,
  SUBSCRIPTION_REVIEWS_KEY,
  subscriptionPrefill,
} from '../domain/subscriptionReview';
import { saveRecurringRule, type RecurringInput } from './recurringRepo';
import {
  confirmSubscription,
  ignoreSubscription,
  loadSubscriptionReviews,
  restoreSubscription,
} from './subscriptionReviewRepo';

jest.mock('expo-sqlite', () => ({}));

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

const now = new Date(2026, 9, 20).getTime();
const evidence = [expense(7), expense(8), expense(9)].map((row) => ({
  ...row,
  category: null,
  allocations: [],
}));
const suggestion = { insight: detectSpendingInsights(evidence, now)[0], evidence };
const input = { ...subscriptionPrefill(suggestion, now), accountId: 1 } as RecurringInput;
let context: ReturnType<typeof fixture>;
beforeEach(async () => {
  context = fixture();
  await migrate(context.expo);
  context.db
    .insert(schema.accounts)
    .values({
      id: 1,
      name: 'Account',
      type: 'bank',
      currency: 'RON',
      color: '#123456',
      icon: 'wallet',
      createdAt: 1,
    })
    .run();
  context.db.insert(schema.merchants).values({ id: 1, name: 'Service' }).run();
  for (const row of evidence)
    context.db
      .insert(schema.transactions)
      .values({
        id: row.id,
        type: row.type,
        amountMinor: row.amountMinor,
        currency: row.currency,
        merchantId: 1,
        occurredAt: row.occurredAt,
        status: row.status,
        source: 'manual',
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
});
afterEach(() => context.sqlite.close());

it('persists ignored identities across reloads/months, reverses them and never changes payments', () => {
  const before = context.db.select().from(schema.transactions).all();
  ignoreSubscription(context.db, suggestion);
  ignoreSubscription(context.db, {
    ...suggestion,
    insight: { ...suggestion.insight, transactionIds: [9, 10, 11] },
  });
  expect(loadSubscriptionReviews(context.db)).toEqual([
    {
      key: reviewKey(suggestion.insight),
      merchant: 'Service',
      currency: 'RON',
      ignored: true,
      ruleId: null,
    },
  ]);
  expect(context.db.select().from(schema.recurringRules).all()).toEqual([]);
  restoreSubscription(context.db, reviewKey(suggestion.insight));
  expect(loadSubscriptionReviews(context.db)).toEqual([]);
  expect(context.db.select().from(schema.transactions).all()).toEqual(before);
});

it('requires explicit confirmation, saves auto-post off and rejects a repeat atomically', () => {
  const before = context.db.select().from(schema.transactions).all();
  const id = confirmSubscription(context.db, suggestion, input);
  expect(context.db.select().from(schema.recurringRules).all()).toEqual([
    expect.objectContaining({ id, autoPost: false, amountMinor: 1000, frequency: 'monthly' }),
  ]);
  expect(loadSubscriptionReviews(context.db)[0]).toMatchObject({ ruleId: id, ignored: false });
  expect(() => confirmSubscription(context.db, suggestion, input)).toThrow('duplicate');
  expect(context.db.select().from(schema.recurringRules).all()).toHaveLength(1);
  expect(context.db.select().from(schema.transactions).all()).toEqual(before);
  ignoreSubscription(context.db, suggestion);
  restoreSubscription(context.db, reviewKey(suggestion.insight));
  expect(loadSubscriptionReviews(context.db)[0]).toMatchObject({ ruleId: id, ignored: false });
});

it('rejects pre-existing, paused and differently priced obligations', () => {
  const id = saveRecurringRule(context.db, { ...input, amountMinor: 1500 });
  context.sqlite.prepare('UPDATE recurring_rules SET active = 0 WHERE id = ?').run(id);
  expect(() => confirmSubscription(context.db, suggestion, input)).toThrow('duplicate');
  expect(context.db.select().from(schema.recurringRules).all()).toHaveLength(1);
  expect(loadSubscriptionReviews(context.db)).toEqual([]);
});

it('rechecks evidence associations made while the review form was open', () => {
  const id = saveRecurringRule(context.db, {
    ...input,
    merchantId: null,
    note: 'Other',
    currency: 'EUR',
  });
  context.sqlite
    .prepare('UPDATE transactions SET recurring_id = ? WHERE id = ?')
    .run(id, evidence[0].id);
  expect(() => confirmSubscription(context.db, suggestion, input)).toThrow('duplicate');
});

it('also protects against duplicates introduced by correcting the suggested merchant', () => {
  context.db.insert(schema.merchants).values({ id: 2, name: 'Other' }).run();
  saveRecurringRule(context.db, { ...input, merchantId: 2, note: 'Other' });
  expect(() => confirmSubscription(context.db, suggestion, { ...input, merchantId: 2 })).toThrow(
    'duplicate',
  );
  expect(context.db.select().from(schema.recurringRules).all()).toHaveLength(1);
});

it('rejects removed or changed evidence and rolls back a failed save', () => {
  expect(() => confirmSubscription(context.db, suggestion, { ...input, accountId: 999 })).toThrow();
  expect(context.db.select().from(schema.recurringRules).all()).toHaveLength(0);
  expect(loadSubscriptionReviews(context.db)).toEqual([]);
  context.sqlite
    .prepare('UPDATE transactions SET amount_minor = 999 WHERE id = ?')
    .run(evidence[0].id);
  expect(() => confirmSubscription(context.db, suggestion, input)).toThrow('stale');
});

it('roundtrips ignored and confirmed review states in backups without new review tables', async () => {
  confirmSubscription(context.db, suggestion, input);
  ignoreSubscription(context.db, suggestion);
  const backup = parseCashioBackup(JSON.stringify(await createCashioBackup(context.expo)));
  expect(backup.version).toBe(5);
  const before = loadSubscriptionReviews(context.db);
  restoreSubscription(context.db, reviewKey(suggestion.insight));
  await restoreCashioBackup(context.expo, backup);
  expect(loadSubscriptionReviews(context.db)).toEqual(before);
  expect(context.db.select().from(schema.transactions).all()).toHaveLength(3);
});

it('accepts old backups without review settings and rejects malformed review settings', async () => {
  const backup = await createCashioBackup(context.expo);
  const { receipts: _receipts, ...legacy } = backup;
  const old = {
    ...legacy,
    version: 3,
  };
  expect(parseCashioBackup(JSON.stringify(old)).tables.app_settings).toEqual([]);
  ignoreSubscription(context.db, suggestion);
  await restoreCashioBackup(context.expo, parseCashioBackup(JSON.stringify(old)));
  expect(loadSubscriptionReviews(context.db)).toEqual([]);
  expect(context.db.select().from(schema.transactions).all()).toHaveLength(3);
  backup.tables.app_settings.push({ key: SUBSCRIPTION_REVIEWS_KEY, value: '[{}]' });
  expect(() => parseCashioBackup(JSON.stringify(backup))).toThrow('Invalid subscription reviews');
});
