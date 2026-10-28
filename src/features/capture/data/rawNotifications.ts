import { and, desc, eq, gte, lt } from 'drizzle-orm';

import { schema, type AppDb } from '@/core/db';
import { NotificationListener } from '@modules/notification-listener';

import { activeCapturePackages } from '../domain/sources';

export type RawNotification = typeof schema.rawNotifications.$inferSelect;
export type RawNotificationHistoryEntry = RawNotification & { transactionId: number | null };

export function applyCaptureSources(db: AppDb): void {
  const accounts = db
    .select({ name: schema.accounts.name, type: schema.accounts.type, archived: schema.accounts.archived })
    .from(schema.accounts)
    .all();
  NotificationListener.setAllowedPackages(activeCapturePackages(accounts));
}

/** Moves notifications queued by the native service into SQLite. Returns how many were stored. */
export async function drainPendingNotifications(db: AppDb): Promise<number> {
  const pending = await NotificationListener.readPending();
  if (pending.length === 0) return 0;

  const earliestMinute = Math.min(...pending.map((notification) => Math.floor(notification.postedAt / 60000)));
  const latestMinute = Math.max(...pending.map((notification) => Math.floor(notification.postedAt / 60000)));
  const known = db
    .select({
      packageName: schema.rawNotifications.packageName,
      title: schema.rawNotifications.title,
      body: schema.rawNotifications.body,
      postedAt: schema.rawNotifications.postedAt,
    })
    .from(schema.rawNotifications)
    .where(
      and(
        gte(schema.rawNotifications.postedAt, earliestMinute * 60000),
        lt(schema.rawNotifications.postedAt, (latestMinute + 1) * 60000),
      ),
    )
    .all();
  const notificationKey = (notification: {
    packageName: string;
    title: string | null;
    body: string;
    postedAt: number;
  }) =>
    `${notification.packageName}|${notification.title ?? ''}|${notification.body}|${Math.floor(notification.postedAt / 60000)}`;
  const seen = new Set(known.map(notificationKey));
  const now = Date.now();

  await db.insert(schema.rawNotifications).values(
    pending.map((notification) => {
      const duplicate = seen.has(notificationKey(notification));
      seen.add(notificationKey(notification));
      return {
        packageName: notification.packageName,
        title: notification.title,
        body: notification.body,
        postedAt: notification.postedAt,
        reviewStatus: duplicate ? ('ignored' as const) : ('open' as const),
        processedAt: duplicate ? now : null,
      };
    }),
  );
  await NotificationListener.deletePending(pending.map((n) => n.id));
  return pending.length;
}

export function listRawNotifications(db: AppDb, limit = 200): Promise<RawNotificationHistoryEntry[]> {
  return db
    .select({
      id: schema.rawNotifications.id,
      packageName: schema.rawNotifications.packageName,
      title: schema.rawNotifications.title,
      body: schema.rawNotifications.body,
      postedAt: schema.rawNotifications.postedAt,
      processedAt: schema.rawNotifications.processedAt,
      reviewStatus: schema.rawNotifications.reviewStatus,
      transactionId: schema.transactions.id,
    })
    .from(schema.rawNotifications)
    .leftJoin(
      schema.transactions,
      eq(schema.transactions.rawNotificationId, schema.rawNotifications.id),
    )
    .orderBy(desc(schema.rawNotifications.postedAt))
    .limit(limit);
}

export function updateNotificationReviewStatus(
  db: AppDb,
  id: number,
  reviewStatus: RawNotification['reviewStatus'],
): void {
  db.update(schema.rawNotifications).set({ reviewStatus }).where(eq(schema.rawNotifications.id, id)).run();
}
