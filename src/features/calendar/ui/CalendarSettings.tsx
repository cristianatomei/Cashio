import { useState } from 'react';
import { Alert } from 'react-native';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';

import { schema, useDb } from '@/core/db';
import { AppText, Button, Card, ListRow } from '@/core/ui';
import { formatMinor } from '@/core/utils/money';
import { newCalendarState } from '../domain/state';
import {
  CALENDAR_STATE_KEY,
  CalendarExportError,
  type CalendarState,
  saveCalendarState,
  syncCalendar,
  writableCalendars,
} from '../data/sync';

export function CalendarSettings() {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const { data: settings } = useLiveQuery(db.select().from(schema.appSettings));
  const raw = settings.find((row) => row.key === CALENDAR_STATE_KEY)?.value;
  const state = raw ? (JSON.parse(raw) as CalendarState) : null;
  const [calendars, setCalendars] = useState<{ id: string; title: string; source: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const errorMessage = (error: unknown) =>
    t(`calendarExport.${error instanceof CalendarExportError ? error.reason : 'error'}`);
  const choose = async () => {
    setBusy(true);
    setMessage('');
    try {
      setCalendars(
        (await writableCalendars()).map((calendar) => ({
          id: calendar.id,
          title: calendar.title,
          source: calendar.source?.name ?? '',
        })),
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const select = (calendar: { id: string; title: string }) => {
    try {
      saveCalendarState(db, newCalendarState(calendar));
      setCalendars([]);
      setMessage(t('calendarExport.ready'));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };
  const run = async (cleanup = false) => {
    setBusy(true);
    setMessage('');
    try {
      const count = await syncCalendar(
        db,
        (payment) =>
          t('calendarExport.event', {
            kind: t(`calendarExport.${payment.kind}`),
            amount: formatMinor(payment.amountMinor, payment.currency, i18n.language),
            estimate: payment.estimated ? t('calendarExport.estimate') : '',
          }),
        cleanup,
      );
      setMessage(cleanup ? t('calendarExport.cleaned') : t('calendarExport.success', { count }));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <AppText variant="heading">{t('calendarExport.title')}</AppText>
      <AppText>{t('calendarExport.privacy')}</AppText>
      <AppText>{t('calendarExport.range')}</AppText>
      <AppText>{t('calendarExport.nativeHint')}</AppText>
      {state ? (
        <>
          <AppText>
            {t(state.enabled ? 'calendarExport.selected' : 'calendarExport.stopped', {
              calendar: state.calendarTitle,
            })}
          </AppText>
          {state.enabled ? (
            <Button title={t('calendarExport.sync')} disabled={busy} onPress={() => void run()} />
          ) : null}
          <Button
            title={t('calendarExport.disable')}
            variant="danger"
            disabled={busy}
            onPress={() =>
              Alert.alert(t('calendarExport.disable'), t('calendarExport.cleanupHint'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('calendarExport.disable'),
                  style: 'destructive',
                  onPress: () => void run(true),
                },
              ])
            }
          />
        </>
      ) : (
        <Button title={t('calendarExport.enable')} loading={busy} onPress={() => void choose()} />
      )}
      {!state
        ? calendars.map((calendar) => (
            <ListRow
              key={calendar.id}
              title={calendar.title}
              subtitle={calendar.source}
              accessibilityLabel={t('calendarExport.choose', {
                calendar: [calendar.title, calendar.source].filter(Boolean).join(' · '),
              })}
              onPress={busy ? undefined : () => select(calendar)}
            />
          ))
        : null}
      {busy ? (
        <AppText accessibilityLiveRegion="polite">{t('calendarExport.working')}</AppText>
      ) : null}
      {message ? <AppText accessibilityLiveRegion="polite">{message}</AppText> : null}
    </Card>
  );
}
