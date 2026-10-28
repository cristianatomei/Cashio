import { and, eq, gte, lt } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState } from 'react-native';

import { Productivity } from '@modules/productivity';
import { schema, useDb } from '@/core/db';
import { formatMinor } from '@/core/utils/money';
import { useAppLock } from '@/features/app-lock';
import { loadAppLockSettings } from '@/features/app-lock/data/settings';
import {
  applyCaptureCategory,
  CAPTURE_KIND,
  CAPTURE_NOTIFICATIONS_SETTING,
  getSetting,
} from '../data/notifications';
import { captureRoute, monthlyCashFlow } from '../domain/productivity';

export function useProductivity(): void {
  const db = useDb();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { settings, authenticate } = useAppLock();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (!Productivity) return;
      try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        const rows = db
          .select({
            type: schema.transactions.type,
            status: schema.transactions.status,
            amountMinor: schema.transactions.amountMinor,
            currency: schema.transactions.currency,
            occurredAt: schema.transactions.occurredAt,
          })
          .from(schema.transactions)
          .where(
            and(
              eq(schema.transactions.status, 'confirmed'),
              gte(schema.transactions.occurredAt, start),
              lt(schema.transactions.occurredAt, end),
            ),
          )
          .all();
        const summary =
          monthlyCashFlow(rows, now.getTime())
            .map(
              ([currency, amount]) =>
                `${currency}: ${formatMinor(amount, currency, i18n.language)}`,
            )
            .join('\n') || t('productivity.noTransactions');
        Productivity.update(
          summary,
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
          loadAppLockSettings(db).enabled,
        );
      } catch (error) {
        console.error('Cashio widget update failed', error);
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 100);
    };
    update();
    const database = addDatabaseChangeListener((event) => {
      if (['transactions', 'app_settings'].includes(event.tableName)) schedule();
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    const interval = setInterval(update, 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      database.remove();
      app.remove();
    };
  }, [db, i18n.language, settings.enabled, t]);

  useEffect(() => {
    const respond = async (response: Notifications.NotificationResponse) => {
      const request = response.notification.request;
      if (request.content.data?.kind !== CAPTURE_KIND) return;
      const key = `${request.identifier}:${response.actionIdentifier}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      try {
        await Notifications.clearLastNotificationResponseAsync();
        const route = captureRoute(request.content.data.transactionId);
        if (!route) return;
        if (
          response.actionIdentifier.startsWith('category:') &&
          getSetting(db, CAPTURE_NOTIFICATIONS_SETTING) === 'true'
        ) {
          if (loadAppLockSettings(db).enabled && !(await authenticate())) return;
          if (
            !applyCaptureCategory(db, request.content.data.transactionId, response.actionIdentifier)
          ) {
            Alert.alert(t('errors.generic'), t('productivity.actionError'));
            router.push(route);
          }
        } else {
          router.push(route);
        }
        await Notifications.dismissNotificationAsync(request.identifier);
      } catch (error) {
        console.error('Captured notification action failed', error);
        Alert.alert(t('errors.generic'), t('productivity.actionError'));
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void respond(response);
    });
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) void respond(response);
      })
      .catch((error: unknown) => console.error('Notification launch response failed', error));
    return () => subscription.remove();
  }, [authenticate, db, router, settings.enabled, t]);
}
