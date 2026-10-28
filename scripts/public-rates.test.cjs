const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, loadTypeScript } = require('./sqlite-test-support.cjs');
const { migrate } = loadTypeScript('src/core/db/migrations.ts');
const { refreshPublicRates } = loadTypeScript('src/features/exchange-rates/data/publicRates.ts');
const { createCashioBackup, parseCashioBackup, restoreCashioBackup } = loadTypeScript(
  'src/features/backup/data/backup.ts',
  { '@/features/loans': loadTypeScript('src/features/loans/domain/storedSchedule.ts') },
);
const payload = ['RON', 'USD', 'GBP'].map((quote, i) => ({
  base: 'EUR',
  quote,
  date: '2026-01-02',
  rate: [5, 1.25, 0.8][i],
}));

test('real SQLite public FX persists dated rows, protects manual collisions, remains idempotent and survives offline failure', async () => {
  const { native, adapter } = createDatabase();
  const request = global.fetch;
  try {
    await migrate(adapter);
    native.exec(`INSERT INTO app_settings VALUES ('public_fx_enabled','1'),('base_currency','RON');
      INSERT INTO exchange_rates (currency,rate_to_base,effective_at,source) VALUES
      ('EUR',4.9,1,'manual'),
      ('USD',4.1,${Date.parse('2026-01-02T23:59:59.999Z')},'manual')`);
    global.fetch = async () => ({ ok: true, json: async () => payload });
    assert.equal(await refreshPublicRates(adapter), 2);
    assert.equal(await refreshPublicRates(adapter), 0);
    const snapshot = native.prepare('SELECT * FROM exchange_rates ORDER BY id').all();
    assert.equal(snapshot.length, 4);
    assert.equal(snapshot[0].rate_to_base, 4.9);
    assert.equal(snapshot[1].source, 'manual');
    assert.equal(snapshot[1].rate_to_base, 4.1);
    assert.equal(snapshot[2].source, 'frankfurter:ECB:RON');
    global.fetch = async () => {
      throw new Error('offline');
    };
    await assert.rejects(refreshPublicRates(adapter), /offline/);
    assert.deepEqual(native.prepare('SELECT * FROM exchange_rates ORDER BY id').all(), snapshot);
    native.exec("UPDATE app_settings SET value='0' WHERE key='public_fx_enabled'");
    let called = false;
    global.fetch = async () => {
      called = true;
      throw new Error('unexpected network');
    };
    await assert.rejects(refreshPublicRates(adapter), /opt-in-required/);
    assert.equal(called, false);
  } finally {
    global.fetch = request;
    native.close();
  }
});

test('real SQLite discards fetched rates if opt-in or base currency changed during the request', async () => {
  const { native, adapter } = createDatabase();
  const request = global.fetch;
  try {
    await migrate(adapter);
    native.exec(
      "INSERT INTO app_settings VALUES ('public_fx_enabled','1'),('base_currency','RON')",
    );
    global.fetch = async () => {
      native.exec("UPDATE app_settings SET value='0' WHERE key='public_fx_enabled'");
      return { ok: true, json: async () => payload };
    };
    await assert.rejects(refreshPublicRates(adapter), /settings-changed/);
    native.exec("UPDATE app_settings SET value='1' WHERE key='public_fx_enabled'");
    global.fetch = async () => {
      native.exec("UPDATE app_settings SET value='EUR' WHERE key='base_currency'");
      return { ok: true, json: async () => payload };
    };
    await assert.rejects(refreshPublicRates(adapter), /settings-changed/);
    assert.equal(native.prepare('SELECT count(*) AS n FROM exchange_rates').get().n, 0);
  } finally {
    global.fetch = request;
    native.close();
  }
});

test('real SQLite backup roundtrips public opt-in, dated manual rates and public source/base; rejects unsupported versions', async () => {
  const { native, adapter } = createDatabase();
  try {
    await migrate(adapter);
    native.exec(`INSERT INTO app_settings VALUES ('public_fx_enabled','0'),('base_currency','RON');
      INSERT INTO exchange_rates (currency,rate_to_base,effective_at,source) VALUES
      ('EUR',4.9,1,'manual'),('USD',4,1767398399999,'frankfurter:ECB:RON')`);
    const backup = await createCashioBackup(adapter);
    const parsed = parseCashioBackup(JSON.stringify(backup));
    native.exec('DELETE FROM exchange_rates; DELETE FROM app_settings');
    await restoreCashioBackup(adapter, parsed);
    assert.deepEqual((await createCashioBackup(adapter)).tables, backup.tables);
    await assert.rejects(
      restoreCashioBackup(adapter, { ...parsed, schemaVersion: 999 }),
      /incompatible/,
    );
    assert.throws(
      () => parseCashioBackup(JSON.stringify({ ...backup, version: 999 })),
      /Unsupported/,
    );
    assert.deepEqual((await createCashioBackup(adapter)).tables, backup.tables);
    assert.deepEqual(native.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    native.close();
  }
});

test('real SQLite executes production Drizzle preference SQL: local dated manual overrides same published date, not later dates', async () => {
  const { native, adapter } = createDatabase();
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Bucharest';
    await migrate(adapter);
    const localManual = new Date(2026, 0, 2).getTime();
    assert.equal(new Date(localManual).toISOString(), '2026-01-01T22:00:00.000Z');
    const insert = native.prepare(
      'INSERT INTO exchange_rates (currency,rate_to_base,effective_at,source) VALUES (?,?,?,?)',
    );
    insert.run('EUR', 4.9, localManual, 'manual');
    insert.run('EUR', 5, Date.parse('2026-01-02T23:59:59.999Z'), 'frankfurter:ECB:RON');
    const { SQLiteSyncDialect } = require('drizzle-orm/sqlite-core');
    const { ratePreferenceOrder } = loadTypeScript('src/features/exchange-rates/data/rateOrder.ts');
    const dialect = new SQLiteSyncDialect();
    const order = ratePreferenceOrder()
      .map((fragment) => dialect.sqlToQuery(fragment).sql)
      .join(', ');
    const query = native.prepare(
      `SELECT rate_to_base FROM exchange_rates ORDER BY ${order} LIMIT 1`,
    );
    assert.equal(query.get().rate_to_base, 4.9);
    insert.run('EUR', 5.1, Date.parse('2026-01-03T23:59:59.999Z'), 'frankfurter:ECB:RON');
    assert.equal(query.get().rate_to_base, 5.1);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
    native.close();
  }
});
