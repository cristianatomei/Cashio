import type { SQLiteDatabase } from 'expo-sqlite';

import { fetchPublicRates, FX_OPT_IN_KEY } from '../domain/publicRates';

export async function refreshPublicRates(db: SQLiteDatabase): Promise<number> {
  const setting = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    FX_OPT_IN_KEY,
  );
  const base = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    'base_currency',
  );
  const baseCurrency = base?.value ?? 'RON';
  const rates = await fetchPublicRates(setting?.value === '1', baseCurrency);
  let inserted = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const enabled = await tx.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      FX_OPT_IN_KEY,
    );
    const currentBase = await tx.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      'base_currency',
    );
    if (enabled?.value !== '1' || (currentBase?.value ?? 'RON') !== baseCurrency) {
      throw new Error('settings-changed');
    }
    for (const rate of rates) {
      const result = await tx.runAsync(
        `INSERT INTO exchange_rates (currency, rate_to_base, effective_at, source)
         VALUES (?, ?, ?, ?) ON CONFLICT(currency, effective_at) DO NOTHING`,
        rate.currency,
        rate.rateToBase,
        rate.effectiveAt,
        rate.source,
      );
      inserted += result.changes;
    }
  });
  return inserted;
}
