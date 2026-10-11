import * as Notifications from 'expo-notifications';

import { schema, type AppDb } from '@/core/db';
import { installmentTotal } from '../domain/ingSchedule';
import { parseStoredLoanSchedule } from './loanScheduleRepo';

const REMINDER_KIND = 'loan_schedule_reminder';
const REMINDER_LIMIT = 50;

export type LoanReminderCopy = {
  title: string;
  body: (scheduleName: string) => string;
};

export async function syncLoanScheduleReminders(db: AppDb, copy: LoanReminderCopy): Promise<void> {
  const allSchedules = db.select().from(schema.loanSchedules).all();
  const now = Date.now();
  const reminders = allSchedules.flatMap((schedule) => {
    const stored = parseStoredLoanSchedule(schedule.installmentsJson);
    if (!stored.remindersEnabled) return [];
    return stored.installments
      .filter((installment) => {
        const notificationAt = new Date(installment.dueAt);
        notificationAt.setDate(notificationAt.getDate() - 1);
        notificationAt.setHours(9, 0, 0, 0);
        return notificationAt.getTime() > now;
      })
      .map((installment) => ({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        installment,
        includeInsurance: stored.includeInsurance,
      }));
  });

  reminders.sort((left, right) => left.installment.dueAt - right.installment.dueAt);
  if (reminders.length > 0 && !(await Notifications.getPermissionsAsync()).granted) {
    throw new Error('Notification permission is not granted.');
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === REMINDER_KIND)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );

  for (const reminder of reminders.slice(0, REMINDER_LIMIT)) {
    const reminderDate = new Date(reminder.installment.dueAt);
    reminderDate.setDate(reminderDate.getDate() - 1);
    reminderDate.setHours(9, 0, 0, 0);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body(reminder.scheduleName),
        data: {
          kind: REMINDER_KIND,
          scheduleId: reminder.scheduleId,
          dueAt: reminder.installment.dueAt,
          amountMinor: installmentTotal(reminder.installment, reminder.includeInsurance),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });
  }
}
