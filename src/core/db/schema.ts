import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

// Must stay in sync with migrations.ts. Amounts are integer minor units (bani).

export const rawNotifications = sqliteTable(
  'raw_notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    packageName: text('package_name').notNull(),
    title: text('title'),
    body: text('body').notNull(),
    postedAt: integer('posted_at').notNull(),
    processedAt: integer('processed_at'),
    reviewStatus: text('review_status', { enum: ['open', 'handled', 'ignored'] })
      .notNull()
      .default('open'),
  },
  (t) => [
    index('idx_raw_notifications_posted_at').on(t.postedAt),
    index('idx_raw_notifications_package_posted_at').on(t.packageName, t.postedAt),
  ],
);

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const transactionReceipts = sqliteTable('transaction_receipts', {
  transactionId: integer('transaction_id')
    .primaryKey()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull().unique(),
});

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['bank', 'cash', 'other'] }).notNull(),
  iban: text('iban'),
  currency: text('currency').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  openingBalanceMinor: integer('opening_balance_minor').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const categoryGroups = sqliteTable('category_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    groupId: integer('group_id')
      .notNull()
      .references(() => categoryGroups.id),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('idx_categories_group').on(t.groupId)],
);

export const merchants = sqliteTable('merchants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  defaultCategoryId: integer('default_category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  icon: text('icon'),
});

export const merchantAliases = sqliteTable(
  'merchant_aliases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    merchantId: integer('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    rawPattern: text('raw_pattern').notNull(),
    matchType: text('match_type', { enum: ['exact', 'contains'] })
      .notNull()
      .default('contains'),
  },
  (t) => [unique().on(t.rawPattern, t.matchType)],
);

export const merchantCategoryRules = sqliteTable(
  'merchant_category_rules',
  {
    merchantId: integer('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['expense', 'income'] }).notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.merchantId, table.type] })],
);

export const savedTransactionFilters = sqliteTable('saved_transaction_filters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  filterJson: text('filter_json').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const recurringRules = sqliteTable('recurring_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id),
  type: text('type', { enum: ['expense', 'income'] }).notNull(),
  amountMinor: integer('amount_minor').notNull(),
  amountVariable: integer('amount_variable', { mode: 'boolean' }).notNull().default(false),
  currency: text('currency').notNull(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  merchantId: integer('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
  note: text('note'),
  frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly', 'yearly'] }).notNull(),
  interval: integer('interval').notNull().default(1),
  nextDue: integer('next_due').notNull(),
  endAt: integer('end_at'),
  autoPost: integer('auto_post', { mode: 'boolean' }).notNull().default(false),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

export const loanSchedules = sqliteTable('loan_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  installmentsJson: text('installments_json').notNull(),
  recurringId: integer('recurring_id').references(() => recurringRules.id, {
    onDelete: 'set null',
  }),
  createdAt: integer('created_at').notNull(),
});

export const transactions = sqliteTable(
  'transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    accountId: integer('account_id').references(() => accounts.id),
    type: text('type', { enum: ['expense', 'income', 'transfer'] }).notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull(),
    baseAmountMinor: integer('base_amount_minor'),
    fxRate: real('fx_rate'),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    merchantId: integer('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
    merchantRaw: text('merchant_raw'),
    note: text('note'),
    transferAccountId: integer('transfer_account_id').references(() => accounts.id),
    transferAmountMinor: integer('transfer_amount_minor'),
    status: text('status', { enum: ['draft', 'confirmed'] })
      .notNull()
      .default('confirmed'),
    source: text('source', {
      enum: ['notification', 'sms', 'manual', 'import', 'recurring'],
    }).notNull(),
    rawNotificationId: integer('raw_notification_id').references(() => rawNotifications.id, {
      onDelete: 'set null',
    }),
    recurringId: integer('recurring_id').references(() => recurringRules.id, {
      onDelete: 'set null',
    }),
    dedupeHash: text('dedupe_hash').unique(),
    occurredAt: integer('occurred_at').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('idx_transactions_occurred_at').on(t.occurredAt),
    index('idx_transactions_account').on(t.accountId),
    index('idx_transactions_category').on(t.categoryId),
    index('idx_transactions_merchant').on(t.merchantId),
    index('idx_transactions_status').on(t.status),
  ],
);

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color'),
});

export const transactionTags = sqliteTable(
  'transaction_tags',
  {
    transactionId: integer('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.transactionId, t.tagId] })],
);

export const transactionAllocations = sqliteTable(
  'transaction_allocations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    transactionId: integer('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    amountMinor: integer('amount_minor').notNull(),
  },
  (t) => [index('idx_transaction_allocations_transaction').on(t.transactionId)],
);

export const budgets = sqliteTable('budgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }),
  groupId: integer('group_id').references(() => categoryGroups.id, { onDelete: 'cascade' }),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(),
  rollover: integer('rollover', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const exchangeRates = sqliteTable(
  'exchange_rates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    currency: text('currency').notNull(),
    rateToBase: real('rate_to_base').notNull(),
    effectiveAt: integer('effective_at').notNull(),
    source: text('source').notNull().default('manual'),
  },
  (t) => [unique().on(t.currency, t.effectiveAt)],
);

export const captureRules = sqliteTable('capture_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pattern: text('pattern').notNull(),
  matchType: text('match_type', { enum: ['exact', 'contains'] })
    .notNull()
    .default('contains'),
  resultType: text('result_type', { enum: ['expense', 'income', 'transfer'] }).notNull(),
  resultCategoryId: integer('result_category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  priority: integer('priority').notNull().default(0),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

export const savingsGoals = sqliteTable('savings_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  targetMinor: integer('target_minor').notNull(),
  currentMinor: integer('current_minor').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const investmentValuations = sqliteTable('investment_valuations', {
  assetId: text('asset_id').primaryKey().notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(),
  valuedAt: integer('valued_at').notNull(),
});
