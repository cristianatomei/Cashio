import { eq } from 'drizzle-orm';

import type { AppDb } from '@/core/db';
import { appSettings } from '@/core/db/schema';

import { isOnboardingCompleted } from '../domain/onboarding';

const ONBOARDING_KEY = 'onboarding_completed';

export function loadOnboardingCompleted(db: AppDb): boolean {
  const saved = db.select().from(appSettings).where(eq(appSettings.key, ONBOARDING_KEY)).get();
  return isOnboardingCompleted(saved?.value);
}

export function saveOnboardingCompleted(db: AppDb): void {
  db.insert(appSettings)
    .values({ key: ONBOARDING_KEY, value: '1' })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: '1' } })
    .run();
}
