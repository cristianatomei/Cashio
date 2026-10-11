import { eq } from 'drizzle-orm';

import type { AppDb } from '@/core/db';
import { appSettings } from '@/core/db/schema';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'theme';

export function parseThemePreference(value: string | undefined): ThemePreference {
  if (value === undefined) return 'system';
  if (value === 'system' || value === 'light' || value === 'dark') return value;
  throw new Error(`Invalid saved theme preference: ${value}`);
}

export function resolveThemeScheme(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): 'light' | 'dark' {
  return preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
}

export function loadThemePreference(db: AppDb): ThemePreference {
  const saved = db.select().from(appSettings).where(eq(appSettings.key, THEME_KEY)).get();
  return parseThemePreference(saved?.value);
}

export function saveThemePreference(db: AppDb, preference: ThemePreference): void {
  db.insert(appSettings)
    .values({ key: THEME_KEY, value: preference })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: preference } })
    .run();
}
