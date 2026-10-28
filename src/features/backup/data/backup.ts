import type { SQLiteDatabase } from 'expo-sqlite';

import { parseStoredLoanSchedule } from '@/features/loans';
import { parseInvestmentAssets } from '@/features/investments/domain/assets';
import { parseSavedFilter } from '@/features/transactions/domain/savedFilters';
import { validateGoal, validateValuation } from '@/features/planning/domain/goals';
import {
  exportReceipt,
  stageReceipts,
  discardReceipt,
  sweepReceiptFiles,
} from '@/features/receipts/data/files';
import {
  checkBackupJsonSize,
  MAX_BACKUP_RECEIPT_BYTES,
  base64Size,
  ReceiptError,
  validatePortableReceipts,
  type PortableReceipt,
} from '@/features/receipts/domain/receipt';
import { CALENDAR_STATE_KEY } from '@/features/calendar/domain/state';

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
  'merchant_category_rules',
  'saved_transaction_filters',
  'savings_goals',
  'investment_valuations',
] as const;

type BackupValue = string | number | null;
type BackupRow = Record<string, BackupValue>;

export type CashioBackup = {
  format: 'cashio-backup';
  version: 1 | 2 | 3 | 4;
  schemaVersion: number;
  createdAt: number;
  tables: Record<(typeof TABLES)[number], BackupRow[]>;
  receipts?: PortableReceipt[];
};

const PRE_PLANNING_TABLES = TABLES.filter(
  (table) => table !== 'savings_goals' && table !== 'investment_valuations',
);
const ORIGINAL_TABLES = PRE_PLANNING_TABLES.filter(
  (table) => table !== 'merchant_category_rules' && table !== 'saved_transaction_filters',
);
const LEGACY_TABLES = ORIGINAL_TABLES.filter(
  (table) => table !== 'transaction_allocations' && table !== 'loan_schedules',
);
const PRE_ALLOCATION_TABLES = ORIGINAL_TABLES.filter(
  (table) => table !== 'transaction_allocations',
);

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
  checkBackupJsonSize(json);
  const parsed: unknown = JSON.parse(json);
  if (
    !isRecord(parsed) ||
    parsed.format !== 'cashio-backup' ||
    (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4)
  ) {
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
  const hasPrePlanningTables =
    tableNames.length === PRE_PLANNING_TABLES.length &&
    PRE_PLANNING_TABLES.every((table) => Object.hasOwn(parsed.tables as object, table));
  if (
    ((parsed.version === 3 || parsed.version === 4) && !hasCurrentTables) ||
    (parsed.version === 2 && !hasCurrentTables && !hasPrePlanningTables)
  )
    throw new Error('The backup does not contain the expected Cashio tables.');
  const hasLegacyTables =
    tableNames.length === LEGACY_TABLES.length &&
    LEGACY_TABLES.every((table) => Object.hasOwn(parsed.tables as object, table));
  const hasPreAllocationTables =
    tableNames.length === PRE_ALLOCATION_TABLES.length &&
    PRE_ALLOCATION_TABLES.every((table) => Object.hasOwn(parsed.tables as object, table));
  const hasOriginalTables =
    tableNames.length === ORIGINAL_TABLES.length &&
    ORIGINAL_TABLES.every((table) => Object.hasOwn(parsed.tables as object, table));
  if (
    !hasCurrentTables &&
    !hasLegacyTables &&
    !hasPreAllocationTables &&
    !hasOriginalTables &&
    !hasPrePlanningTables
  ) {
    throw new Error('The backup does not contain the expected Cashio tables.');
  }

  const tables = {
    ...parsed.tables,
    loan_schedules: parsed.tables.loan_schedules ?? [],
    transaction_allocations: parsed.tables.transaction_allocations ?? [],
    merchant_category_rules: parsed.tables.merchant_category_rules ?? [],
    saved_transaction_filters: parsed.tables.saved_transaction_filters ?? [],
    savings_goals: parsed.tables.savings_goals ?? [],
    investment_valuations: parsed.tables.investment_valuations ?? [],
  } as CashioBackup['tables'];

  for (const table of TABLES) {
    const rows: unknown = tables[table];
    if (
      !Array.isArray(rows) ||
      !rows.every((row) => isRecord(row) && Object.values(row).every(isBackupValue))
    ) {
      throw new Error(`The backup data for "${table}" is invalid.`);
    }

    for (const row of tables.saved_transaction_filters) {
      if (
        typeof row.name !== 'string' ||
        !row.name.trim() ||
        typeof row.filter_json !== 'string' ||
        !Number.isSafeInteger(row.id) ||
        Number(row.id) <= 0 ||
        !Number.isSafeInteger(row.created_at) ||
        Number(row.created_at) < 0
      ) {
        throw new Error('The backup contains an invalid saved transaction filter.');
      }
      parseSavedFilter(row.filter_json);
    }
    for (const row of tables.merchant_category_rules) {
      const category = tables.categories.find((category) => category.id === row.category_id);
      const group = tables.category_groups.find((group) => group.id === category?.group_id);
      if (
        !Number.isSafeInteger(row.merchant_id) ||
        Number(row.merchant_id) <= 0 ||
        !Number.isSafeInteger(row.category_id) ||
        Number(row.category_id) <= 0 ||
        !tables.merchants.some((merchant) => merchant.id === row.merchant_id) ||
        group?.kind !== row.type ||
        (row.type !== 'expense' && row.type !== 'income') ||
        !Number.isSafeInteger(row.updated_at) ||
        Number(row.updated_at) < 0
      ) {
        throw new Error('The backup contains an invalid merchant category rule.');
      }
    }
  }

  const goalIds = new Set<number>();
  for (const row of tables.savings_goals) {
    if (
      typeof row.name !== 'string' ||
      typeof row.currency !== 'string' ||
      typeof row.target_minor !== 'number' ||
      typeof row.current_minor !== 'number' ||
      typeof row.id !== 'number' ||
      !Number.isSafeInteger(row.id) ||
      row.id <= 0 ||
      goalIds.has(row.id) ||
      !Number.isSafeInteger(row.created_at) ||
      !Number.isSafeInteger(row.updated_at)
    ) {
      throw new Error('The backup contains an invalid savings goal.');
    }
    validateGoal({
      name: row.name,
      currency: row.currency,
      targetMinor: row.target_minor,
      currentMinor: row.current_minor,
    });
    goalIds.add(row.id);
  }
  const valuedAssets = new Set<string>();
  for (const row of tables.investment_valuations) {
    if (
      typeof row.asset_id !== 'string' ||
      typeof row.amount_minor !== 'number' ||
      typeof row.currency !== 'string' ||
      typeof row.valued_at !== 'number' ||
      valuedAssets.has(row.asset_id)
    ) {
      throw new Error('The backup contains an invalid investment valuation.');
    }
    validateValuation({
      assetId: row.asset_id,
      amountMinor: row.amount_minor,
      currency: row.currency,
      valuedAt: row.valued_at,
    });
    valuedAssets.add(row.asset_id);
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
  const investmentAssets = settings.find((row) => row.key === 'investment_assets')?.value;
  if (language !== undefined && language !== 'ro' && language !== 'en') {
    throw new Error('The backup contains an unsupported language preference.');
  }
  if (theme !== undefined && theme !== 'system' && theme !== 'light' && theme !== 'dark') {
    throw new Error('The backup contains an unsupported theme preference.');
  }
  if (investmentAssets !== undefined) {
    if (typeof investmentAssets !== 'string') {
      throw new Error('The backup contains an invalid tracked investment asset list.');
    }
    parseInvestmentAssets(investmentAssets);
  }

  if (parsed.version === 4) {
    validatePortableReceipts(
      parsed.receipts,
      new Set(tables.transactions.map((row) => Number(row.id))),
    );
  } else if (parsed.receipts !== undefined) {
    throw new ReceiptError('invalidBackup');
  }
  return { ...parsed, tables } as CashioBackup;
}

export function serializeCashioBackup(backup: CashioBackup): string {
  const json = JSON.stringify(backup);
  checkBackupJsonSize(json);
  return json;
}

export async function createCashioBackup(db: SQLiteDatabase): Promise<CashioBackup> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const tables = {} as CashioBackup['tables'];
  const receipts: PortableReceipt[] = [];

  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const table of TABLES) {
      const rows = await transaction.getAllAsync<BackupRow>(`SELECT * FROM "${table}"`);
      tables[table] =
        table === 'app_settings'
          ? rows.filter(
              (row) =>
                row.key !== 'backup_folder_uri' &&
                row.key !== 'backup_last_at' &&
                row.key !== CALENDAR_STATE_KEY,
            )
          : rows;
    }
    const links = await transaction.getAllAsync<{ transaction_id: number; filename: string }>(
      'SELECT transaction_id, filename FROM "transaction_receipts"',
    );
    let total = 0;
    for (const link of links) {
      const base64 = exportReceipt(link.filename);
      total += base64Size(base64);
      if (total > MAX_BACKUP_RECEIPT_BYTES) throw new ReceiptError('backupLimit');
      receipts.push({ transactionId: link.transaction_id, base64 });
    }
  });

  return {
    format: 'cashio-backup',
    version: 4,
    schemaVersion: version?.user_version ?? 0,
    createdAt: Date.now(),
    tables,
    receipts,
  };
}

export function isSupportedBackupSchemaVersion(
  schemaVersion: number,
  currentVersion: number,
): boolean {
  return (
    Number.isSafeInteger(schemaVersion) && schemaVersion >= 5 && schemaVersion <= currentVersion
  );
}

export async function restoreCashioBackup(db: SQLiteDatabase, backup: CashioBackup): Promise<void> {
  backup = parseCashioBackup(JSON.stringify(backup));
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = current?.user_version ?? 0;
  if (!isSupportedBackupSchemaVersion(backup.schemaVersion, currentVersion)) {
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

  // Stage under new names before touching the database. A failed restore keeps old files/rows.
  const staged = stageReceipts(backup.receipts ?? []);
  try {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      // Calendar IDs and consent belong to this installation, not to an imported backup.
      // Keep its ownership journal so existing phone events can still be cleaned up.
      const calendarState = await transaction.getFirstAsync<{ key: string; value: string }>(
        'SELECT key, value FROM app_settings WHERE key = ?',
        [CALENDAR_STATE_KEY],
      );
      await transaction.execAsync('PRAGMA defer_foreign_keys = ON;');
      await transaction.execAsync('DELETE FROM transaction_receipts;');
      for (const table of [...TABLES].reverse()) {
        await transaction.execAsync(`DELETE FROM "${table}";`);
      }

      for (const table of TABLES) {
        const columns = columnsByTable.get(table);
        if (!columns) throw new Error(`Database table "${table}" is unavailable.`);

        for (const row of backup.tables[table]) {
          if (table === 'app_settings' && row.key === CALENDAR_STATE_KEY) continue;
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
      for (const row of staged) {
        await transaction.runAsync(
          'INSERT INTO transaction_receipts (transaction_id, filename) VALUES (?, ?)',
          [row.transaction_id, row.filename],
        );
      }
      if (calendarState) {
        await transaction.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?)', [
          calendarState.key,
          calendarState.value,
        ]);
      }
      const violations = await transaction.getAllAsync('PRAGMA foreign_key_check');
      if (violations.length) throw new Error('The backup contains invalid references.');
    });
  } catch (error) {
    for (const row of staged) discardReceipt(row.filename);
    throw error;
  }
  try {
    sweepReceiptFiles(new Set(staged.map((row) => row.filename)));
  } catch {
    throw new ReceiptError('restoreCleanupFailed');
  }
}
