import { eq } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';

import { requestLocalNotificationPermission } from '@/core/notifications';
import { schema, type AppDb } from '@/core/db';

const REMINDERS_SETTING = 'recurring_reminders_enabled';
const REMINDER_CHANNEL = 'cashio_recurring_reminders';
const REMINDER_KIND = 'recurring_due_reminder';

type ReminderCopy = { title: string; body: (name: string) => string };

function saveSetting(db: AppDb, enabled: boolean): void {
  db.insert(schema.appSettings)
    .values({ key: REMINDERS_SETTING, value: String(enabled) })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: String(enabled) },
    })
    .run();
}

async function cancelReminder(id: number): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(
        (notification) =>
          notification.content.data?.kind === REMINDER_KIND &&
          notification.content.data?.recurringRuleId === id,
      )
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
  );
}

async function scheduleReminder(db: AppDb, id: number, copy: ReminderCopy): Promise<void> {
  const enabled = db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, REMINDERS_SETTING))
    .get()?.value;
  if (enabled !== 'true') return;

  const rule = db
    .select()
    .from(schema.recurringRules)
    .where(eq(schema.recurringRules.id, id))
    .get();
  if (!rule?.active) return;

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) throw new Error('Notification permission is not granted');

  const reminderDate = new Date(rule.nextDue);
  reminderDate.setDate(reminderDate.getDate() - 1);
  reminderDate.setHours(9, 0, 0, 0);
  if (reminderDate.getTime() <= Date.now()) return;

  const name = rule.note?.trim() || copy.title;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body(name),
      data: { kind: REMINDER_KIND, recurringRuleId: id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
}

export async function syncRecurringReminder(
  db: AppDb,
  id: number,
  copy: ReminderCopy,
): Promise<void> {
  await cancelReminder(id);
  await scheduleReminder(db, id, copy);
}

export async function setRecurringRemindersEnabled(
  db: AppDb,
  enabled: boolean,
  copy: ReminderCopy,
): Promise<boolean> {
  if (
    enabled &&
    !(await requestLocalNotificationPermission(REMINDER_CHANNEL, 'Cashio bill reminders'))
  ) {
    return false;
  }
  saveSetting(db, enabled);
  if (!enabled) {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((notification) => notification.content.data?.kind === REMINDER_KIND)
        .map((notification) =>
          Notifications.cancelScheduledNotificationAsync(notification.identifier),
        ),
    );
    return true;
  }

  const rules = db.select().from(schema.recurringRules).all();
  await Promise.all(rules.map((rule) => syncRecurringReminder(db, rule.id, copy)));
  return true;
}
