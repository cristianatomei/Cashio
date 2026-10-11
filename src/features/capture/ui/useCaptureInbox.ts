import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDb } from '@/core/db';
import { currentLanguage } from '@/core/i18n';
import { NotificationListener } from '@modules/notification-listener';

import {
  listRawNotifications,
  updateNotificationReviewStatus,
  type RawNotification,
  type RawNotificationHistoryEntry,
} from '../data/rawNotifications';
import { syncCapture } from '../data/sync';

export function useCaptureInbox() {
  const { t } = useTranslation();
  const db = useDb();
  const [notifications, setNotifications] = useState<RawNotificationHistoryEntry[]>([]);
  const [accessGranted, setAccessGranted] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await syncCapture(db, currentLanguage());
      setAccessGranted(NotificationListener.isAccessGranted());
      setNotifications(await listRawNotifications(db));
    } catch (error) {
      console.error('Failed to refresh captured notifications', error);
      Alert.alert(t('errors.generic'), t('common.refreshError'));
    }
  }, [db, t]);

  const setReviewStatus = useCallback(
    (id: number, reviewStatus: RawNotification['reviewStatus']) => {
      updateNotificationReviewStatus(db, id, reviewStatus);
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, reviewStatus } : item)),
      );
    },
    [db],
  );

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearTimeout(initial);
      sub.remove();
    };
  }, [refresh]);

  return { notifications, accessGranted, refresh, setReviewStatus };
}
