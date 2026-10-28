import type { AppDb, Language } from '@/core/db';
import { latestTransactionId, notifyNewCaptures } from '@/features/productivity/data/notifications';

import { applyCaptureSources, drainPendingNotifications } from './rawNotifications';
import { processRawNotifications } from './pipeline';

let inFlight: Promise<number> | null = null;

/** Moves native-queued notifications into the database and turns them into transactions. */
export function syncCapture(db: AppDb, language: Language): Promise<number> {
  // Concurrent callers (app start, foreground, inbox screen) share one run to avoid duplicates.
  inFlight ??= (async () => {
    applyCaptureSources(db);
    await drainPendingNotifications(db);
    const afterId = latestTransactionId(db);
    const created = processRawNotifications(db, language);
    await notifyNewCaptures(db, afterId);
    return created;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
