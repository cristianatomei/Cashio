import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { desc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { schema, useDb } from '@/core/db';
import { currentLanguage } from '@/core/i18n';
import { NotificationListener } from '@modules/notification-listener';

import { getCaptureHealth, parseCaptureInactivityDays } from '../domain/health';
import { syncCapture } from '../data/sync';

const ACCESS_SEEN_SETTING = 'capture_access_seen';
const INACTIVITY_DAYS_SETTING = 'capture_inactivity_days';

export function useCaptureHealth() {
  const db = useDb();
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { data: settings } = useLiveQuery(db.select().from(schema.appSettings));
  const { data: latestNotification } = useLiveQuery(
    db
      .select({ postedAt: schema.rawNotifications.postedAt })
      .from(schema.rawNotifications)
      .orderBy(desc(schema.rawNotifications.postedAt))
      .limit(1),
  );

  const checkAccess = useCallback(() => {
    const granted = NotificationListener.isAccessGranted();
    setAccessGranted(granted);
    setNow(Date.now());
    if (granted) {
      db.insert(schema.appSettings)
        .values({ key: ACCESS_SEEN_SETTING, value: '1' })
        .onConflictDoNothing()
        .run();
    }
  }, [db]);

  useEffect(() => {
    const initial = setTimeout(() => {
      checkAccess();
      void syncCapture(db, currentLanguage()).catch((error: unknown) => {
        console.error('Failed to check capture health', error);
      });
    }, 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkAccess();
        void syncCapture(db, currentLanguage()).catch((error: unknown) => {
          console.error('Failed to check capture health', error);
        });
      }
    });
    const timer = setInterval(() => setNow(Date.now()), 6 * 60 * 60 * 1000);
    return () => {
      clearTimeout(initial);
      subscription.remove();
      clearInterval(timer);
    };
  }, [checkAccess, db]);

  const accessWasGranted = settings.some(
    (setting) => setting.key === ACCESS_SEEN_SETTING && setting.value === '1',
  );
  const inactivityDays = parseCaptureInactivityDays(
    settings.find((setting) => setting.key === INACTIVITY_DAYS_SETTING)?.value,
  );

  return Platform.OS !== 'android' || accessGranted === null
    ? null
    : getCaptureHealth({
        accessGranted,
        accessWasGranted,
        lastNotificationAt: latestNotification[0]?.postedAt ?? null,
        now,
        inactivityDays,
      });
}
