import { useState } from 'react';
import { desc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { Switch } from 'react-native';
import { useTranslation } from 'react-i18next';

import { schema, useDb } from '@/core/db';
import { AppText, Button, Card } from '@/core/ui';
import { refreshPublicRates } from '../data/publicRates';
import { FX_OPT_IN_KEY, isRateStale } from '../domain/publicRates';

export function PublicRatesSettings() {
  const { t } = useTranslation();
  const db = useDb();
  const sqlite = useSQLiteContext();
  const { data: settings } = useLiveQuery(db.select().from(schema.appSettings));
  const { data: rates } = useLiveQuery(
    db.select().from(schema.exchangeRates).orderBy(desc(schema.exchangeRates.effectiveAt)),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const enabled = settings.find((row) => row.key === FX_OPT_IN_KEY)?.value === '1';
  const base = settings.find((row) => row.key === 'base_currency')?.value ?? 'RON';
  const latest = rates.find((row) => row.source === `frankfurter:ECB:${base}`);
  const toggle = (value: boolean) => {
    try {
      db.insert(schema.appSettings)
        .values({ key: FX_OPT_IN_KEY, value: value ? '1' : '0' })
        .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: value ? '1' : '0' } })
        .run();
      setMessage('');
    } catch {
      setMessage(t('publicFx.saveError'));
    }
  };
  const refresh = async () => {
    setBusy(true);
    setMessage('');
    try {
      const count = await refreshPublicRates(sqlite);
      setMessage(t('publicFx.success', { count }));
    } catch {
      setMessage(t('publicFx.error'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <AppText variant="heading">{t('publicFx.title')}</AppText>
      <AppText>{t('publicFx.privacy')}</AppText>
      <Switch
        accessibilityLabel={t('publicFx.enable')}
        value={enabled}
        disabled={busy}
        onValueChange={toggle}
      />
      <AppText>{enabled ? t('publicFx.enabled') : t('publicFx.disabled')}</AppText>
      <AppText>{t('publicFx.source')}</AppText>
      <AppText>{t('publicFx.terms')}</AppText>
      <AppText>
        {latest
          ? t('publicFx.asOf', { date: new Date(latest.effectiveAt).toISOString().slice(0, 10) })
          : t('publicFx.noRates')}
      </AppText>
      {latest && isRateStale(latest.effectiveAt) ? <AppText>{t('publicFx.stale')}</AppText> : null}
      <Button
        title={t('publicFx.refresh')}
        disabled={!enabled}
        loading={busy}
        onPress={() => void refresh()}
      />
      {message ? <AppText accessibilityLiveRegion="polite">{message}</AppText> : null}
    </Card>
  );
}
