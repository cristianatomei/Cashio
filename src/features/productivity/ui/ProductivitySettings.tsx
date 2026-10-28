import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Switch } from 'react-native';

import { Productivity } from '@modules/productivity';
import { schema, useDb } from '@/core/db';
import { AppText, Card, ListRow } from '@/core/ui';
import {
  CAPTURE_NOTIFICATION_ERROR,
  CAPTURE_NOTIFICATIONS_SETTING,
  setCaptureNotificationsEnabled,
} from '../data/notifications';

export function ProductivitySettings() {
  const { t } = useTranslation();
  const db = useDb();
  const { data } = useLiveQuery(db.select().from(schema.appSettings));
  const [busy, setBusy] = useState(false);
  const enabled = data.find((row) => row.key === CAPTURE_NOTIFICATIONS_SETTING)?.value === 'true';
  const error = data.find((row) => row.key === CAPTURE_NOTIFICATION_ERROR)?.value;
  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (!(await setCaptureNotificationsEnabled(db, next))) {
        Alert.alert(t('errors.generic'), t('productivity.permissionDenied'));
      }
    } catch (cause) {
      console.error('Failed to configure captured payment notifications', cause);
      Alert.alert(t('errors.generic'), t('productivity.deliveryError'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppText variant="heading">{t('productivity.title')}</AppText>
      <Card>
        <ListRow
          title={t('productivity.captureToggle')}
          subtitle={t('productivity.captureHint')}
          trailing={
            <Switch
              accessibilityLabel={t('productivity.captureToggle')}
              disabled={busy}
              value={enabled}
              onValueChange={(next) => void toggle(next)}
            />
          }
        />
      </Card>
      {error ? <AppText color="textSecondary">{t('productivity.deliveryError')}</AppText> : null}
      {Platform.OS === 'android' ? (
        <AppText color="textSecondary">
          {t(Productivity ? 'productivity.androidHint' : 'productivity.nativeMissing')}
        </AppText>
      ) : null}
    </>
  );
}
