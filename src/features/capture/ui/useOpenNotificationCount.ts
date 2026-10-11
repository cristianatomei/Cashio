import { count, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { schema, useDb } from '@/core/db';

export function useOpenNotificationCount(): number {
  const db = useDb();
  const { data } = useLiveQuery(
    db
      .select({ count: count() })
      .from(schema.rawNotifications)
      .where(eq(schema.rawNotifications.reviewStatus, 'open')),
  );
  return data[0]?.count ?? 0;
}
