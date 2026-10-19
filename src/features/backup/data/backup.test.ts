import { migrations } from '@/core/db/migrations';

import { isSupportedBackupSchemaVersion, parseCashioBackup } from './backup';

describe('parseCashioBackup', () => {
  const backup = {
    format: 'cashio-backup',
    version: 1,
    schemaVersion: 5,
    createdAt: 1,
    tables: {
      raw_notifications: [],
      app_settings: [],
      accounts: [],
      category_groups: [],
      categories: [],
      merchants: [],
      merchant_aliases: [],
      recurring_rules: [],
      loan_schedules: [],
      transactions: [],
      tags: [],
      transaction_tags: [],
      budgets: [],
      exchange_rates: [],
      capture_rules: [],
    },
  };

  it('accepts a backup with the legacy table set and adds empty newer tables', () => {
    expect(parseCashioBackup(JSON.stringify(backup))).toEqual({
      ...backup,
      tables: {
        ...backup.tables,
        loan_schedules: [],
        transaction_allocations: [],
      },
    });
  });

  it('rejects incompatible formats and missing tables', () => {
    expect(() => parseCashioBackup(JSON.stringify({ ...backup, version: 2 }))).toThrow(
      'Unsupported backup format or version.',
    );
    const { capture_rules: _captureRules, ...tables } = backup.tables;
    expect(() => parseCashioBackup(JSON.stringify({ ...backup, tables }))).toThrow(
      'expected Cashio tables',
    );
  });

  it('rejects non-primitive values inside table rows', () => {
    const invalid = {
      ...backup,
      tables: { ...backup.tables, accounts: [{ name: { nested: true } }] },
    };
    expect(() => parseCashioBackup(JSON.stringify(invalid))).toThrow(
      'data for "accounts" is invalid',
    );
  });

  it('rejects invalid saved loan schedules before restoring data', () => {
    const invalid = {
      ...backup,
      tables: {
        ...backup.tables,
        loan_schedules: [
          {
            name: 'Loan',
            currency: 'RON',
            installments_json: '{',
          },
        ],
      },
    };
    expect(() => parseCashioBackup(JSON.stringify(invalid))).toThrow(SyntaxError);
  });

  it('rejects invalid saved preferences before restore can replace data', () => {
    const invalid = {
      ...backup,
      tables: { ...backup.tables, app_settings: [{ key: 'theme', value: 'ultraviolet' }] },
    };
    expect(() => parseCashioBackup(JSON.stringify(invalid))).toThrow(
      'unsupported theme preference',
    );
  });

  it('rejects invalid tracked investment assets before restore can replace data', () => {
    const invalid = {
      ...backup,
      tables: {
        ...backup.tables,
        app_settings: [{ key: 'investment_assets', value: '[{"symbol":"bad!"}]' }],
      },
    };
    expect(() => parseCashioBackup(JSON.stringify(invalid))).toThrow(
      'investment asset list contains an invalid asset',
    );
  });

  it('propagates malformed JSON errors', () => {
    expect(() => parseCashioBackup('{')).toThrow(SyntaxError);
  });
});

describe('backup schema compatibility', () => {
  it('accepts the current, previous, and existing legacy schema versions', () => {
    const current = migrations.length;
    expect(isSupportedBackupSchemaVersion(current, current)).toBe(true);
    expect(isSupportedBackupSchemaVersion(current - 1, current)).toBe(true);
    expect(isSupportedBackupSchemaVersion(current - 4, current)).toBe(true);
    expect(isSupportedBackupSchemaVersion(current - 2, current)).toBe(false);
  });
});
