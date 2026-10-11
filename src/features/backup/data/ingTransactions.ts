import { and, desc, eq, lte } from 'drizzle-orm';

import { DEFAULT_CURRENCY, schema, type AppDb } from '@/core/db';
import { convertToBaseMinor } from '@/core/utils/currency';
import type { IngTransactionRow } from '../domain/ingCsv';

export type IngImportResult = {
  imported: number;
  duplicates: number;
  currencyMismatches: number;
};

export function importIngTransactions(
  db: AppDb,
  accountId: number,
  rows: readonly IngTransactionRow[],
): IngImportResult {
  const account = db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId)).get();
  if (!account) throw new Error('The selected account no longer exists.');

  const baseCurrency =
    db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'base_currency'))
      .get()?.value ?? DEFAULT_CURRENCY;

  return db.transaction((tx) => {
    let imported = 0;
    let duplicates = 0;
    let currencyMismatches = 0;
    const occurrences = new Map<string, number>();

    for (const row of rows) {
      if (row.currency !== account.currency) {
        currencyMismatches += 1;
        continue;
      }

      const fingerprint = JSON.stringify([
        accountId,
        row.date,
        row.amountMinor,
        row.currency,
        row.description,
      ]);
      const occurrence = occurrences.get(fingerprint) ?? 0;
      occurrences.set(fingerprint, occurrence + 1);
      const dedupeHash = JSON.stringify([fingerprint, occurrence]);
      const existing = tx
        .select({ id: schema.transactions.id })
        .from(schema.transactions)
        .where(eq(schema.transactions.dedupeHash, dedupeHash))
        .get();
      if (existing) {
        duplicates += 1;
        continue;
      }

      const exchangeRate =
        row.currency === baseCurrency
          ? 1
          : tx
              .select({ rateToBase: schema.exchangeRates.rateToBase })
              .from(schema.exchangeRates)
              .where(
                and(
                  eq(schema.exchangeRates.currency, row.currency),
                  lte(schema.exchangeRates.effectiveAt, row.date),
                ),
              )
              .orderBy(desc(schema.exchangeRates.effectiveAt))
              .limit(1)
              .get()?.rateToBase;

      tx.insert(schema.transactions)
        .values({
          accountId,
          type: row.amountMinor < 0 ? 'expense' : 'income',
          amountMinor: Math.abs(row.amountMinor),
          currency: row.currency,
          baseAmountMinor:
            exchangeRate === undefined
              ? null
              : convertToBaseMinor(Math.abs(row.amountMinor), exchangeRate),
          fxRate: exchangeRate ?? null,
          categoryId: null,
          merchantId: null,
          merchantRaw: row.description,
          note: null,
          transferAccountId: null,
          transferAmountMinor: null,
          status: 'confirmed',
          source: 'import',
          rawNotificationId: null,
          recurringId: null,
          dedupeHash,
          occurredAt: row.date,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();
      imported += 1;
    }

    return { imported, duplicates, currencyMismatches };
  });
}
