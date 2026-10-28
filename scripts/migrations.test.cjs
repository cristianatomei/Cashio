const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, loadTypeScript } = require('./sqlite-test-support.cjs');
const { migrations, migrate } = loadTypeScript('src/core/db/migrations.ts');

function seed(native, version) {
  native.exec(`INSERT INTO raw_notifications
    (id,package_name,title,body,posted_at,processed_at)
    VALUES (31,'synthetic.test','Synthetic','Synthetic only',1234,1250)`);
  // v1's original finance tables were deliberately never populated in the app.
  // v2 rebuilds them; only raw notifications are promised to survive v1 -> v2.
  if (version === 1) return;
  native.exec(`
    INSERT INTO app_settings VALUES ('synthetic','keep-me');
    INSERT INTO accounts (id,name,type,currency,color,icon,opening_balance_minor,created_at)
      VALUES (11,'Synthetic bank','bank','RON','#000','wallet',98765,1),
             (12,'Synthetic cash','cash','RON','#fff','cash',123,1);
    INSERT INTO category_groups (id,name,kind,color,icon) VALUES (21,'Synthetic','expense','#000','cart');
    INSERT INTO categories (id,group_id,name,icon) VALUES (22,21,'Synthetic food','cart');
    INSERT INTO merchants (id,name,default_category_id) VALUES (23,'Synthetic merchant',22);
    INSERT INTO merchant_aliases (merchant_id,raw_pattern) VALUES (23,'synthetic');
    INSERT INTO recurring_rules (id,account_id,type,amount_minor,currency,category_id,merchant_id,frequency,next_due,created_at)
      VALUES (24,11,'expense',1234,'RON',22,23,'monthly',100,1);
    INSERT INTO transactions
      (id,account_id,type,amount_minor,currency,base_amount_minor,fx_rate,category_id,merchant_id,merchant_raw,note,transfer_account_id,transfer_amount_minor,status,source,raw_notification_id,recurring_id,dedupe_hash,occurred_at,created_at,updated_at)
      VALUES (41,11,'expense',1234,'EUR',6170,5,22,23,'Synthetic raw','Preserve all columns',NULL,NULL,'draft','notification',31,24,'synthetic-hash',100,101,102),
             (42,11,'transfer',2000,'RON',2000,1,NULL,NULL,NULL,'Synthetic transfer',12,2000,'confirmed','manual',NULL,NULL,'synthetic-transfer',200,201,202);
    INSERT INTO tags (id,name) VALUES (25,'Synthetic tag');
    INSERT INTO transaction_tags VALUES (41,25);
    INSERT INTO budgets (category_id,amount_minor,currency,created_at) VALUES (22,10000,'RON',1);
    INSERT INTO exchange_rates (currency,rate_to_base,effective_at,source) VALUES ('EUR',5,1,'manual');
    INSERT INTO capture_rules (pattern,result_type,result_category_id) VALUES ('synthetic','expense',22);
  `);
  if (version >= 3) native.exec("UPDATE raw_notifications SET review_status='handled'");
  if (version >= 4) native.exec('UPDATE recurring_rules SET amount_variable=1');
  if (version >= 5)
    native.exec(`INSERT INTO loan_schedules
    (name,currency,installments_json,recurring_id,created_at) VALUES ('Synthetic loan','RON','[]',24,1)`);
  if (version >= 6)
    native.exec(`INSERT INTO transactions
    (id,account_id,type,amount_minor,currency,status,source,occurred_at,created_at,updated_at)
    VALUES (43,NULL,'income',123,'RON','confirmed','manual',300,301,302)`);
  if (version >= 7)
    native.exec(
      'INSERT INTO transaction_allocations (transaction_id,category_id,amount_minor) VALUES (41,22,1234)',
    );
  if (version >= 8) native.exec("UPDATE accounts SET iban='SYNTHETIC-NOT-AN-IBAN' WHERE id=11");
}

function snapshot(native) {
  const tables = native
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  return Object.fromEntries(
    tables.map(({ name }) => [
      name,
      native
        .prepare(`SELECT * FROM "${name}" ORDER BY rowid`)
        .all()
        .map((row) => ({ ...row })),
    ]),
  );
}

for (let version = 0; version <= migrations.length; version++) {
  test(`real SQLite migration v${version} -> v${migrations.length} preserves supported synthetic data and FKs`, async () => {
    const { native, adapter } = createDatabase();
    try {
      native.exec('PRAGMA foreign_keys=ON');
      for (let i = 0; i < version; i++) native.exec(migrations[i]);
      native.exec(`PRAGMA user_version=${version}`);
      if (version) seed(native, version);
      const before = snapshot(native);
      await migrate(adapter);
      assert.equal(native.prepare('PRAGMA user_version').get().user_version, migrations.length);
      assert.equal(native.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
      assert.deepEqual(native.prepare('PRAGMA foreign_key_check').all(), []);
      assert.equal(native.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      const after = snapshot(native);
      for (const [table, rows] of Object.entries(before)) {
        if (version === 1 && table !== 'raw_notifications') continue;
        // Existing columns/values must survive even when migrations add columns.
        for (const [index, row] of rows.entries()) {
          for (const [column, value] of Object.entries(row)) {
            assert.equal(after[table][index][column], value, `${table}[${index}].${column}`);
          }
        }
      }
      if (version >= 2 && version < 7) {
        assert.deepEqual(
          native
            .prepare('SELECT transaction_id,category_id,amount_minor FROM transaction_allocations')
            .all()
            .map((row) => ({ ...row })),
          [{ transaction_id: 41, category_id: 22, amount_minor: 1234 }],
        );
      }
      const migrated = snapshot(native);
      await migrate(adapter);
      assert.deepEqual(snapshot(native), migrated, 'rerunning migrate must not change data');
      assert.throws(
        () => native.exec('INSERT INTO transaction_tags VALUES (999999,999999)'),
        /FOREIGN KEY/,
      );
      if (version >= 2) {
        native.exec(`
          INSERT OR IGNORE INTO transaction_receipts (transaction_id, filename)
          VALUES (41, 'synthetic-41.jpg'), (42, 'synthetic-42.png')
        `);
        native.exec('DELETE FROM transactions WHERE id=41');
        assert.deepEqual(
          native.prepare('SELECT * FROM transaction_receipts').all().map((row) => ({ ...row })),
          [{ transaction_id: 42, filename: 'synthetic-42.png' }],
        );
        assert.equal(native.prepare('SELECT count(*) AS n FROM transaction_tags').get().n, 0);
        assert.equal(
          native.prepare('SELECT count(*) AS n FROM transaction_allocations').get().n,
          0,
        );
        assert.equal(native.prepare('SELECT count(*) AS n FROM recurring_rules').get().n, 1);
      }
    } finally {
      native.close();
    }
  });
}

test('real SQLite failed v6 rebuild rolls back all data and version, and reenables FKs', async () => {
  const { native, adapter } = createDatabase();
  try {
    native.exec('PRAGMA foreign_keys=ON');
    for (let i = 0; i < 5; i++) native.exec(migrations[i]);
    native.exec('PRAGMA user_version=5');
    seed(native, 5);
    const before = snapshot(native);
    const exec = adapter.execAsync;
    adapter.execAsync = async (sql) => {
      await exec(sql);
      if (sql === migrations[5]) throw new Error('synthetic interruption');
    };
    await assert.rejects(migrate(adapter), /synthetic interruption/);
    assert.equal(native.prepare('PRAGMA user_version').get().user_version, 5);
    assert.equal(native.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.deepEqual(snapshot(native), before);
    assert.deepEqual(native.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    native.close();
  }
});
