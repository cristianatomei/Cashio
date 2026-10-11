import type { SQLiteDatabase } from 'expo-sqlite';
import { migrations } from '@/core/db/migrations';

import { parseStoredLoanSchedule } from '@/features/loans';

const TABLES = [
  'raw_notifications',
  'app_settings',
  'accounts',
  'category_groups',
  'categories',
  'merchants',
  'merchant_aliases',
  'recurring_rules',
  'loan_schedules',
  'transactions',
  'transaction_allocations',
  'tags',
  'transaction_tags',
  'budgets',
  'exchange_rates',
  'capture_rules',
] as const;

type BackupValue = string | number | null;
type BackupRow = Record<string, BackupValue>;

export type CashioBackup = {
  format: 'cashio-backup';
  version: 1;
  schemaVersion: number;
  createdAt: number;
  tables: Record<(typeof TABLES)[number], BackupRow[]>;
};

const LEGACY_TABLES = TABLES.filter(
  (table) => table !== 'transaction_allocations' && table !== 'loan_schedules',
);
const PRE_ALLOCATION_TABLES = TABLES.filter((table) => table !== 'transaction_allocations');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBackupValue(value: unknown): value is BackupValue {
  return (
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

export function parseCashioBackup(json: string): CashioBackup {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed) || parsed.format !== 'cashio-backup' || parsed.version !== 1) {
    throw new Error('Unsupported backup format or version.');
  }
  if (
    !Number.isSafeInteger(parsed.schemaVersion) ||
    !Number.isSafeInteger(parsed.createdAt) ||
    !isRecord(parsed.tables)
  ) {
    throw new Error('The backup metadata is invalid.');
  }

  const tableNames = Object.keys(parsed.tables);
  const hasCurrentTables =
    tableNames.length === TABLES.length &&
    TABLES.every((table) => Object.hasOwn(parsed.tables as object, table));
  const hasLegacyTables =
    tableNames.length === LEGACY_TABLES.length &&
    LEGACY_TABLES.every((table) => Object.hasOwn(parsed.tables as object, table));
  const hasPreAllocationTables =
    tableNames.length === PRE_ALLOCATION_TABLES.length &&
    PRE_ALLOCATION_TABLES.every((table) => Object.hasOwn(parsed.tables as object, table));
  if (!hasCurrentTables && !hasLegacyTables && !hasPreAllocationTables) {
    throw new Error('The backup does not contain the expected Cashio tables.');
  }

  const tables = {
    ...parsed.tables,
    loan_schedules: parsed.tables.loan_schedules ?? [],
    transaction_allocations: parsed.tables.transaction_allocations ?? [],
  } as CashioBackup['tables'];

  for (const table of TABLES) {
    const rows: unknown = tables[table];
    if (
      !Array.isArray(rows) ||
      !rows.every((row) => isRecord(row) && Object.values(row).every(isBackupValue))
    ) {
      throw new Error(`The backup data for "${table}" is invalid.`);
    }
  }

  for (const row of tables.loan_schedules) {
    if (
      typeof row.name !== 'string' ||
      row.name.trim() === '' ||
      typeof row.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(row.currency) ||
      typeof row.installments_json !== 'string'
    ) {
      throw new Error('The backup contains an invalid loan schedule.');
    }
    parseStoredLoanSchedule(row.installments_json);
  }

  const settings = tables.app_settings as BackupRow[];
  const language = settings.find((row) => row.key === 'language')?.value;
  const theme = settings.find((row) => row.key === 'theme')?.value;
  if (language !== undefined && language !== 'ro' && language !== 'en') {
    throw new Error('The backup contains an unsupported language preference.');
  }
  if (theme !== undefined && theme !== 'system' && theme !== 'light' && theme !== 'dark') {
    throw new Error('The backup contains an unsupported theme preference.');
  }

  return { ...parsed, tables } as CashioBackup;
}

export async function createCashioBackup(db: SQLiteDatabase): Promise<CashioBackup> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const tables = {} as CashioBackup['tables'];

  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const table of TABLES) {
      tables[table] = await transaction.getAllAsync<BackupRow>(`SELECT * FROM "${table}"`);
    }
  });

  return {
    format: 'cashio-backup',
    version: 1,
    schemaVersion: version?.user_version ?? 0,
    createdAt: Date.now(),
    tables,
  };
}

export async function restoreCashioBackup(db: SQLiteDatabase, backup: CashioBackup): Promise<void> {
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = current?.user_version ?? 0;
  const previousSupportedVersion = migrations.length - 2;
  if (
    backup.schemaVersion !== currentVersion &&
    backup.schemaVersion !== previousSupportedVersion
  ) {
    throw new Error('This backup was created with an incompatible Cashio database version.');
  }

  const columnsByTable = new Map<string, Set<string>>();
  for (const table of TABLES) {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}")`);
    columnsByTable.set(table, new Set(columns.map((column) => column.name)));
    for (const row of backup.tables[table]) {
      if (Object.keys(row).some((column) => !columnsByTable.get(table)?.has(column))) {
        throw new Error(`The backup contains unknown columns in "${table}".`);
      }
    }
  }

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync('PRAGMA defer_foreign_keys = ON;');
    for (const table of [...TABLES].reverse()) {
      await transaction.execAsync(`DELETE FROM "${table}";`);
    }

    for (const table of TABLES) {
      const columns = columnsByTable.get(table);
      if (!columns) throw new Error(`Database table "${table}" is unavailable.`);

      for (const row of backup.tables[table]) {
        const names = Object.keys(row);
        if (names.length === 0) throw new Error(`A row in "${table}" has no columns.`);
        if (names.some((name) => !columns.has(name))) {
          throw new Error(`The backup contains unknown columns in "${table}".`);
        }
        const quotedNames = names.map((name) => `"${name}"`).join(', ');
        const placeholders = names.map(() => '?').join(', ');
        await transaction.runAsync(
          `INSERT INTO "${table}" (${quotedNames}) VALUES (${placeholders})`,
          names.map((name) => row[name]),
        );
      }
    }
  });
}
