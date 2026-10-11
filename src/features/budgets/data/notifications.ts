import { eq } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';

import { requestLocalNotificationPermission } from '@/core/notifications';
import { schema, type AppDb } from '@/core/db';
import { addMonths, startOfMonth } from '@/core/utils/dates';

import { calculateBudgetUsage, crossedBudgetThresholds } from '../domain/budget';

const ALERTS_SETTING = 'budget_alerts_enabled';
const ALERT_CHANNEL = 'cashio_budget_alerts';

function saveSetting(db: AppDb, key: string, value: string): void {
  db.insert(schema.appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value } })
    .run();
}

export async function setBudgetAlertsEnabled(db: AppDb, enabled: boolean): Promise<boolean> {
  if (
    enabled &&
    !(await requestLocalNotificationPermission(ALERT_CHANNEL, 'Cashio budget alerts'))
  ) {
    return false;
  }
  saveSetting(db, ALERTS_SETTING, String(enabled));
  return true;
}

export async function notifyBudgetThresholds(
  db: AppDb,
  transactionId: number,
  formatAlert: (budgetName: string, threshold: number) => { title: string; body: string },
): Promise<void> {
  const alertsEnabled = db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, ALERTS_SETTING))
    .get()?.value;
  if (alertsEnabled !== 'true') return;

  const transaction = db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.id, transactionId))
    .get();
  if (!transaction || transaction.type !== 'expense' || transaction.status !== 'confirmed') return;

  const currentMonth = startOfMonth(Date.now());
  const nextMonth = addMonths(currentMonth, 1);
  if (transaction.occurredAt < currentMonth || transaction.occurredAt >= nextMonth) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) throw new Error('Notification permission is not granted');

  const budgets = db.select().from(schema.budgets).all();
  const transactionRows = db.select().from(schema.transactions).all();
  const allocationRows = db.select().from(schema.transactionAllocations).all();
  const allocationsByTransaction = new Map<
    number,
    { categoryId: number | null; amountMinor: number }[]
  >();
  for (const allocation of allocationRows) {
    allocationsByTransaction.set(allocation.transactionId, [
      ...(allocationsByTransaction.get(allocation.transactionId) ?? []),
      { categoryId: allocation.categoryId, amountMinor: allocation.amountMinor },
    ]);
  }
  const transactions = transactionRows.map((transaction) => ({
    ...transaction,
    allocations: allocationsByTransaction.get(transaction.id),
  }));
  const groups = db.select().from(schema.categoryGroups).all();
  const categories = db.select().from(schema.categories).all();
  const groupByCategory = new Map(categories.map((category) => [category.id, category.groupId]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  for (const budget of budgets) {
    const usage = calculateBudgetUsage(budget, transactions, groupByCategory, currentMonth);
    const key = `budget_alerts_${budget.id}_${new Date(currentMonth).getFullYear()}_${new Date(currentMonth).getMonth() + 1}`;
    const previousValue = db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key))
      .get()?.value;
    const alreadyNotified: number[] = previousValue ? (JSON.parse(previousValue) as number[]) : [];
    const newlyReached = crossedBudgetThresholds(usage, alreadyNotified);
    const name =
      (budget.categoryId === null ? undefined : categoryNames.get(budget.categoryId)) ??
      (budget.groupId === null ? undefined : groupNames.get(budget.groupId)) ??
      'Budget';

    for (const threshold of newlyReached) {
      const copy = formatAlert(name, threshold);
      await Notifications.scheduleNotificationAsync({
        content: { title: copy.title, body: copy.body, data: { budgetId: budget.id, threshold } },
        trigger: null,
      });
      saveSetting(db, key, JSON.stringify([...alreadyNotified, threshold]));
      alreadyNotified.push(threshold);
    }
  }
}
