import { eq } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';

import { discardReceipt } from './files';
import { ReceiptError } from '../domain/receipt';

export function loadReceipt(db: AppDb, transactionId?: number): string | null {
  if (transactionId === undefined) return null;
  return (
    db
      .select()
      .from(schema.transactionReceipts)
      .where(eq(schema.transactionReceipts.transactionId, transactionId))
      .get()?.filename ?? null
  );
}

export function saveReceipt(db: AppDb, transactionId: number, filename: string | null): void {
  if (filename) {
    db.insert(schema.transactionReceipts)
      .values({ transactionId, filename })
      .onConflictDoUpdate({ target: schema.transactionReceipts.transactionId, set: { filename } })
      .run();
    return;
  }
  db.delete(schema.transactionReceipts)
    .where(eq(schema.transactionReceipts.transactionId, transactionId))
    .run();
}

export function cleanupReceipts(db: AppDb, filenames: string[]): void {
  let failed = false;
  for (const filename of new Set(filenames)) {
    if (
      db
        .select()
        .from(schema.transactionReceipts)
        .where(eq(schema.transactionReceipts.filename, filename))
        .get()
    )
      continue;
    try {
      discardReceipt(filename);
    } catch {
      failed = true;
    }
  }
  if (failed) throw new ReceiptError('cleanupFailed');
}
