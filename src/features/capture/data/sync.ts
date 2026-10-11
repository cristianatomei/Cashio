import type { AppDb, Language } from '@/core/db';

import { applyCaptureSources, drainPendingNotifications } from './rawNotifications';
import { processRawNotifications } from './pipeline';

let inFlight: Promise<number> | null = null;

/** Moves native-queued notifications into the database and turns them into transactions. */
export function syncCapture(db: AppDb, language: Language): Promise<number> {
  // Concurrent callers (app start, foreground, inbox screen) share one run to avoid duplicates.
  inFlight ??= (async () => {
    applyCaptureSources();
    await drainPendingNotifications(db);
    return processRawNotifications(db, language);
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
