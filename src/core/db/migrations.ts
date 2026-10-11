import type { SQLiteDatabase } from 'expo-sqlite';

// Append-only: never edit an existing entry. PRAGMA user_version tracks how many have run.
export const migrations: readonly string[] = [
  `
  CREATE TABLE raw_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_name TEXT NOT NULL,
    title TEXT,
    body TEXT NOT NULL,
    posted_at INTEGER NOT NULL,
    processed_at INTEGER
  );
  CREATE INDEX idx_raw_notifications_posted_at ON raw_notifications (posted_at);

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    parent_id INTEGER,
    color TEXT
  );

  CREATE TABLE merchant_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_pattern TEXT NOT NULL,
    display_name TEXT NOT NULL,
    category_id INTEGER REFERENCES categories (id),
    match_type TEXT NOT NULL DEFAULT 'contains'
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    direction TEXT NOT NULL,
    kind TEXT NOT NULL,
    merchant_raw TEXT,
    merchant_alias_id INTEGER REFERENCES merchant_aliases (id),
    category_id INTEGER REFERENCES categories (id),
    source TEXT NOT NULL,
    raw_notification_id INTEGER REFERENCES raw_notifications (id),
    dedupe_hash TEXT NOT NULL UNIQUE,
    occurred_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_transactions_occurred_at ON transactions (occurred_at);
  `,
  // v2: tables from v1 other than raw_notifications were never populated, so they are rebuilt.
  `
  DROP TABLE transactions;
  DROP TABLE merchant_aliases;
  DROP TABLE categories;

  CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'other')),
    currency TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    opening_balance_minor INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE category_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES category_groups (id),
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_categories_group ON categories (group_id);

  CREATE TABLE merchants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    icon TEXT
  );

  CREATE TABLE merchant_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id INTEGER NOT NULL REFERENCES merchants (id) ON DELETE CASCADE,
    raw_pattern TEXT NOT NULL,
    match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('exact', 'contains')),
    UNIQUE (raw_pattern, match_type)
  );

  CREATE TABLE recurring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts (id),
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    currency TEXT NOT NULL,
    category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    merchant_id INTEGER REFERENCES merchants (id) ON DELETE SET NULL,
    note TEXT,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval INTEGER NOT NULL DEFAULT 1,
    next_due INTEGER NOT NULL,
    end_at INTEGER,
    auto_post INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts (id),
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    currency TEXT NOT NULL,
    base_amount_minor INTEGER,
    fx_rate REAL,
    category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    merchant_id INTEGER REFERENCES merchants (id) ON DELETE SET NULL,
    merchant_raw TEXT,
    note TEXT,
    transfer_account_id INTEGER REFERENCES accounts (id),
    transfer_amount_minor INTEGER,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed')),
    source TEXT NOT NULL CHECK (source IN ('notification', 'sms', 'manual', 'import', 'recurring')),
    raw_notification_id INTEGER REFERENCES raw_notifications (id) ON DELETE SET NULL,
    recurring_id INTEGER REFERENCES recurring_rules (id) ON DELETE SET NULL,
    dedupe_hash TEXT UNIQUE,
    occurred_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_transactions_occurred_at ON transactions (occurred_at);
  CREATE INDEX idx_transactions_account ON transactions (account_id);
  CREATE INDEX idx_transactions_category ON transactions (category_id);
  CREATE INDEX idx_transactions_merchant ON transactions (merchant_id);
  CREATE INDEX idx_transactions_status ON transactions (status);

  CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT
  );

  CREATE TABLE transaction_tags (
    transaction_id INTEGER NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
  );

  CREATE TABLE budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories (id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES category_groups (id) ON DELETE CASCADE,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    currency TEXT NOT NULL,
    rollover INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency TEXT NOT NULL,
    rate_to_base REAL NOT NULL,
    effective_at INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    UNIQUE (currency, effective_at)
  );

  CREATE TABLE capture_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('exact', 'contains')),
    result_type TEXT NOT NULL CHECK (result_type IN ('expense', 'income', 'transfer')),
    result_category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1
  );
  `,
  `
  ALTER TABLE raw_notifications
    ADD COLUMN review_status TEXT NOT NULL DEFAULT 'open'
    CHECK (review_status IN ('open', 'handled', 'ignored'));
  `,
  `
  ALTER TABLE recurring_rules
    ADD COLUMN amount_variable INTEGER NOT NULL DEFAULT 0
    CHECK (amount_variable IN (0, 1));
  `,
  `
  CREATE TABLE loan_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    installments_json TEXT NOT NULL,
    recurring_id INTEGER REFERENCES recurring_rules (id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  );
  `,
  `
  CREATE TABLE transactions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts (id),
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    currency TEXT NOT NULL,
    base_amount_minor INTEGER,
    fx_rate REAL,
    category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    merchant_id INTEGER REFERENCES merchants (id) ON DELETE SET NULL,
    merchant_raw TEXT,
    note TEXT,
    transfer_account_id INTEGER REFERENCES accounts (id),
    transfer_amount_minor INTEGER,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed')),
    source TEXT NOT NULL CHECK (source IN ('notification', 'sms', 'manual', 'import', 'recurring')),
    raw_notification_id INTEGER REFERENCES raw_notifications (id) ON DELETE SET NULL,
    recurring_id INTEGER REFERENCES recurring_rules (id) ON DELETE SET NULL,
    dedupe_hash TEXT UNIQUE,
    occurred_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  INSERT INTO transactions_new (
    id, account_id, type, amount_minor, currency, base_amount_minor, fx_rate,
    category_id, merchant_id, merchant_raw, note, transfer_account_id, transfer_amount_minor,
    status, source, raw_notification_id, recurring_id, dedupe_hash, occurred_at, created_at, updated_at
  )
  SELECT
    id, account_id, type, amount_minor, currency, base_amount_minor, fx_rate,
    category_id, merchant_id, merchant_raw, note, transfer_account_id, transfer_amount_minor,
    status, source, raw_notification_id, recurring_id, dedupe_hash, occurred_at, created_at, updated_at
  FROM transactions;
  DROP TABLE transactions;
  ALTER TABLE transactions_new RENAME TO transactions;
  CREATE INDEX idx_transactions_occurred_at ON transactions (occurred_at);
  CREATE INDEX idx_transactions_account ON transactions (account_id);
  CREATE INDEX idx_transactions_category ON transactions (category_id);
  CREATE INDEX idx_transactions_merchant ON transactions (merchant_id);
  CREATE INDEX idx_transactions_status ON transactions (status);
  `,
  `
  CREATE TABLE transaction_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    amount_minor INTEGER NOT NULL
  );
  CREATE INDEX idx_transaction_allocations_transaction
    ON transaction_allocations (transaction_id);

  INSERT INTO transaction_allocations (transaction_id, category_id, amount_minor)
  SELECT id, category_id, amount_minor
  FROM transactions
  WHERE category_id IS NOT NULL AND type != 'transfer';
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let target = current + 1; target <= migrations.length; target++) {
    const rebuildingTransactions = target === 6;
    if (rebuildingTransactions) await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      if (rebuildingTransactions) {
        // foreign_keys is connection-scoped, so use the same connection as the PRAGMA.
        await db.withTransactionAsync(async () => {
          await db.execAsync(migrations[target - 1]);
          await db.execAsync(`PRAGMA user_version = ${target}`);
        });
      } else {
        await db.withExclusiveTransactionAsync(async (tx) => {
          await tx.execAsync(migrations[target - 1]);
          await tx.execAsync(`PRAGMA user_version = ${target}`);
        });
      }
    } finally {
      if (rebuildingTransactions) await db.execAsync('PRAGMA foreign_keys = ON;');
    }
  }
}
