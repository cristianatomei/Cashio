import { inArray } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';

import { APP_LOCK_TIMEOUT_MINUTES } from '../domain/timeout';

export const APP_LOCK_ENABLED_SETTING = 'app_lock_enabled';
export const APP_LOCK_TIMEOUT_SETTING = 'app_lock_timeout_minutes';

export type AppLockSettings = {
  enabled: boolean;
  timeoutMinutes: number;
};

export function loadAppLockSettings(db: AppDb): AppLockSettings {
  const rows = db
    .select({ key: schema.appSettings.key, value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(inArray(schema.appSettings.key, [APP_LOCK_ENABLED_SETTING, APP_LOCK_TIMEOUT_SETTING]))
    .all();
  const values = new Map(rows.map(({ key, value }) => [key, value]));
  const timeout = Number(values.get(APP_LOCK_TIMEOUT_SETTING));
  const timeoutMinutes = APP_LOCK_TIMEOUT_MINUTES.find((value) => value === timeout) ?? 0;

  return {
    enabled: values.get(APP_LOCK_ENABLED_SETTING) === 'true',
    timeoutMinutes,
  };
}

export function saveAppLockSettings(db: AppDb, settings: AppLockSettings): void {
  const values = [
    { key: APP_LOCK_ENABLED_SETTING, value: String(settings.enabled) },
    { key: APP_LOCK_TIMEOUT_SETTING, value: String(settings.timeoutMinutes) },
  ];
  db.transaction((tx) => {
    for (const setting of values) {
      tx.insert(schema.appSettings)
        .values(setting)
        .onConflictDoUpdate({
          target: schema.appSettings.key,
          set: { value: setting.value },
        })
        .run();
    }
  });
}
