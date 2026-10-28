import { and, desc, eq, gt } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { schema, type AppDb } from '@/core/db';
import { i18next } from '@/core/i18n';
import { requestLocalNotificationPermission } from '@/core/notifications';
import { loadAppLockSettings } from '@/features/app-lock/data/settings';
import { canNotifyCapture, frequentCategories, positiveId } from '../domain/productivity';

export const CAPTURE_NOTIFICATIONS_SETTING = 'capture_notifications_enabled';
export const CAPTURE_NOTIFICATION_ERROR = 'capture_notification_error';
export const CAPTURE_KIND = 'cashio_capture';
const CHANNEL = 'cashio_capture';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: notification.request.content.data?.kind === CAPTURE_KIND,
    shouldShowList: notification.request.content.data?.kind === CAPTURE_KIND,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function getSetting(db: AppDb, key: string): string | undefined {
  return db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key)).get()?.value;
}

export function setSetting(db: AppDb, key: string, value: string): void {
  db.insert(schema.appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value } })
    .run();
}

export async function setCaptureNotificationsEnabled(
  db: AppDb,
  enabled: boolean,
): Promise<boolean> {
  if (
    enabled &&
    !(await requestLocalNotificationPermission(CHANNEL, i18next.t('productivity.title')))
  ) {
    return false;
  }
  if (!enabled) {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((item) => item.request.content.data?.kind === CAPTURE_KIND)
        .map((item) => Notifications.dismissNotificationAsync(item.request.identifier)),
    );
  }
  setSetting(db, CAPTURE_NOTIFICATIONS_SETTING, String(enabled));
  setSetting(db, CAPTURE_NOTIFICATION_ERROR, '');
  return true;
}

export function latestTransactionId(db: AppDb): number {
  return (
    db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .orderBy(desc(schema.transactions.id))
      .limit(1)
      .get()?.id ?? 0
  );
}

/** Notifications are best effort after commit; a delivery failure must never re-import a payment. */
export async function notifyNewCaptures(db: AppDb, afterId: number): Promise<void> {
  if (getSetting(db, CAPTURE_NOTIFICATIONS_SETTING) !== 'true') return;
  try {
    const rows = db
      .select()
      .from(schema.transactions)
      .where(
        and(
          gt(schema.transactions.id, afterId),
          eq(schema.transactions.source, 'notification'),
          eq(schema.transactions.type, 'expense'),
        ),
      )
      .all();
    if (!rows.length) return;
    if (!(await Notifications.getPermissionsAsync()).granted) throw new Error('Permission denied');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: i18next.t('productivity.title'),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const locked = loadAppLockSettings(db).enabled;
    const categories = locked
      ? []
      : frequentCategories(
          db
            .select({ type: schema.transactions.type, categoryId: schema.transactions.categoryId })
            .from(schema.transactions)
            .where(eq(schema.transactions.status, 'confirmed'))
            .all(),
          db
            .select({ id: schema.categories.id, name: schema.categories.name })
            .from(schema.categories)
            .all(),
        );
    await Notifications.setNotificationCategoryAsync(CAPTURE_KIND, [
      ...categories.map((category) => ({
        identifier: `category:${category.id}`,
        buttonTitle: category.name,
        options: { opensAppToForeground: true, isAuthenticationRequired: true },
      })),
      {
        identifier: 'open',
        buttonTitle: i18next.t('productivity.open'),
        options: { opensAppToForeground: true, isAuthenticationRequired: true },
      },
    ]);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const presented = await Notifications.getPresentedNotificationsAsync();
    const day = new Date().toLocaleDateString('en-CA');
    const key = `capture_notification_count_${day}`;
    let daily = Number(getSetting(db, key) ?? 0);
    if (!Number.isFinite(daily) || daily < 0) daily = 5;
    let delivered = 0;
    for (const row of rows) {
      if (!canNotifyCapture(daily, scheduled.length, presented.length + delivered)) break;
      // Reserve before delivery: a crash may suppress one alert, never duplicate or exceed the cap.
      setSetting(db, key, String(++daily));
      await Notifications.scheduleNotificationAsync({
        identifier: `cashio-capture-${row.id}`,
        content: {
          title: i18next.t('productivity.capturedTitle'),
          body: i18next.t('productivity.capturedBody'),
          categoryIdentifier: CAPTURE_KIND,
          data: { kind: CAPTURE_KIND, transactionId: row.id },
        },
        trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
      });
      delivered++;
    }
    setSetting(db, CAPTURE_NOTIFICATION_ERROR, '');
  } catch (error) {
    setSetting(db, CAPTURE_NOTIFICATION_ERROR, 'delivery');
    console.error('Captured payment notification failed', error);
  }
}

export function applyCaptureCategory(db: AppDb, transactionId: unknown, action: string): boolean {
  const id = positiveId(transactionId);
  const categoryId = action.startsWith('category:') ? positiveId(action.slice(9)) : null;
  if (id === null || categoryId === null) return false;
  const transaction = db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.id, id))
    .get();
  const category = db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, categoryId))
    .get();
  const split = db
    .select()
    .from(schema.transactionAllocations)
    .where(eq(schema.transactionAllocations.transactionId, id))
    .limit(1)
    .get();
  if (
    !transaction ||
    transaction.type !== 'expense' ||
    transaction.source !== 'notification' ||
    !category ||
    split
  )
    return false;
  db.update(schema.transactions)
    .set({ categoryId, updatedAt: Date.now() })
    .where(eq(schema.transactions.id, id))
    .run();
  return true;
}
