import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_ACCOUNTS, DEFAULT_CURRENCY, DEFAULT_GROUPS, type Language } from './defaults';

const SEEDED_KEY = 'defaults_seeded';

export async function seedDefaults(db: SQLiteDatabase, language: Language): Promise<void> {
  const seeded = await db.getFirstAsync('SELECT 1 FROM app_settings WHERE key = ?', [SEEDED_KEY]);
  if (seeded) return;

  const now = Date.now();

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const [accountIndex, account] of DEFAULT_ACCOUNTS.entries()) {
      await tx.runAsync(
        `INSERT INTO accounts (name, type, currency, color, icon, sort_order, archived, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          account.name[language],
          account.type,
          DEFAULT_CURRENCY,
          account.color,
          account.icon,
          accountIndex,
          account.archived ? 1 : 0,
          now,
        ],
      );
    }

    for (const [groupIndex, group] of DEFAULT_GROUPS.entries()) {
      const inserted = await tx.runAsync(
        'INSERT INTO category_groups (name, kind, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
        [group.name[language], group.kind, group.color, group.icon, groupIndex],
      );
      for (const [categoryIndex, category] of group.categories.entries()) {
        await tx.runAsync(
          'INSERT INTO categories (group_id, name, icon, sort_order) VALUES (?, ?, ?, ?)',
          [inserted.lastInsertRowId, category.name[language], category.icon, categoryIndex],
        );
      }
    }

    await tx.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?)', [
      'base_currency',
      DEFAULT_CURRENCY,
    ]);
    await tx.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?)', [SEEDED_KEY, '1']);
  });
}
