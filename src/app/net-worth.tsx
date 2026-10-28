import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useDb } from '@/core/db';
import { AppText, Card, Screen, SectionHeader, TextField } from '@/core/ui';
import { formatMinor, minorToInput, parseAmountToMinor } from '@/core/utils/money';
import { useNetWorth } from '@/features/planning/data/queries';
import { saveValuation } from '@/features/planning/data/repo';
import { dateInput, valuationDate } from '@/features/planning/domain/valuationDate';
import { PlanningButton } from '@/features/planning/ui/PlanningButton';
import { usePlanningTime } from '@/features/planning/ui/usePlanningTime';

export default function NetWorthScreen() {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const router = useRouter();
  const now = usePlanningTime();
  const worth = useNetWorth(now);
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const money = (minor: number) => formatMinor(minor, worth.baseCurrency, locale);
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(worth.baseCurrency);
  const [date, setDate] = useState(dateInput(now));
  const amountMinor = parseAmountToMinor(amount);
  const at = valuationDate(date, now);
  const valid =
    Number.isSafeInteger(amountMinor) &&
    amountMinor !== null &&
    amountMinor >= 0 &&
    /^[A-Z]{3}$/.test(currency) &&
    at !== null;
  const edit = (assetId: string) => {
    const value = worth.valuations.find((valuation) => valuation.assetId === assetId);
    setEditing(assetId);
    setAmount(value ? minorToInput(value.amountMinor) : '');
    setCurrency(value?.currency ?? worth.baseCurrency);
    setDate(dateInput(value?.valuedAt ?? now));
  };
  const save = () => {
    if (!editing || !valid || amountMinor === null || at === null) return;
    try {
      saveValuation(db, { assetId: editing, amountMinor, currency, valuedAt: at });
      setEditing(null);
    } catch {
      Alert.alert(t('errors.generic'), t('planning.saveError'));
    }
  };
  return (
    <Screen title={t('planning.netWorth')} topInset={false}>
      <AppText color="textSecondary">{t('planning.worthHint')}</AppText>
      <Card style={{ gap: 12 }}>
        <AppText variant="heading">
          {t('planning.asOf', { date: new Date(now).toLocaleDateString(locale) })}
        </AppText>
        <AppText variant="title">
          {worth.loading || worth.error || worth.netMinor === null
            ? t('planning.unavailable')
            : money(worth.netMinor)}
        </AppText>
        <AppText color="textSecondary">
          {t(
            worth.loading
              ? 'planning.loading'
              : worth.error
                ? 'planning.loadError'
                : `planning.status.${worth.status}`,
          )}
        </AppText>
        {!worth.loading && !worth.error && worth.unknownCount > 0 ? (
          <AppText color="warning">{t('planning.excluded', { count: worth.unknownCount })}</AppText>
        ) : null}
      </Card>
      <AppText color="textSecondary">{t('planning.loanEstimate')}</AppText>
      <AppText color="textSecondary">{t('planning.ratesHint')}</AppText>
      {!worth.loading && !worth.error
        ? (['accounts', 'investments', 'loans'] as const).map((section) => (
            <Card key={section} style={{ gap: 12 }}>
              <SectionHeader title={t(`planning.${section}`)} />
              <AppText>
                {worth.loading || worth.error || worth[section].knownMinor === null
                  ? t('planning.unavailable')
                  : money(worth[section].knownMinor)}
              </AppText>
              <AppText color="textSecondary">
                {t(`planning.status.${worth[section].status}`)}
              </AppText>
              {!worth[section].rows.length ? (
                <AppText color="textSecondary">{t('planning.noEntries')}</AppText>
              ) : null}
              {worth[section].rows.map((row) => (
                <Card key={row.key} style={{ gap: 8 }}>
                  <AppText variant="heading">{row.name || t('planning.investments')}</AppText>
                  <AppText>
                    {row.amountMinor === null
                      ? t('planning.unavailable')
                      : formatMinor(row.amountMinor, row.currency, locale)}
                  </AppText>
                  <AppText color={row.reason ? 'warning' : 'textSecondary'}>
                    {row.reason
                      ? t(`planning.reason.${row.reason}`)
                      : t('planning.converted', { amount: money(row.baseMinor!) })}
                  </AppText>
                  <AppText variant="caption" color="textSecondary">
                    {t('planning.valueDate', { date: new Date(row.at).toLocaleDateString(locale) })}
                  </AppText>
                  {row.rateAt !== undefined ? (
                    <AppText variant="caption" color="textSecondary">
                      {t('planning.rateDate', {
                        date: new Date(row.rateAt).toLocaleDateString(locale),
                      })}
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </Card>
          ))
        : null}
      <SectionHeader title={t('planning.valuations')} />
      <AppText color="textSecondary">{t('planning.valuationHint')}</AppText>
      <PlanningButton
        title={t('planning.manageInvestments')}
        onPress={() => router.push('/investments')}
      />
      {worth.assets.map((asset) => (
        <PlanningButton
          key={asset.id}
          title={t('planning.valueAsset', { name: asset.name })}
          onPress={() => edit(asset.id)}
        />
      ))}
      {editing ? (
        <Card style={{ gap: 12 }}>
          <AppText variant="heading">
            {worth.assets.find((asset) => asset.id === editing)?.name}
          </AppText>
          <TextField
            label={t('planning.value')}
            accessibilityLabel={t('planning.value')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('planning.currency')}
            accessibilityLabel={t('planning.currency')}
            value={currency}
            onChangeText={(value) => setCurrency(value.toUpperCase())}
            maxLength={3}
            autoCapitalize="characters"
          />
          <TextField
            label={t('planning.valuationDate')}
            accessibilityLabel={t('planning.valuationDate')}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            maxLength={10}
          />
          <PlanningButton title={t('common.save')} onPress={save} disabled={!valid} />
          <PlanningButton title={t('common.cancel')} onPress={() => setEditing(null)} />
        </Card>
      ) : null}
      <PlanningButton title={t('planning.manageRatesLoans')} onPress={() => router.push('/data')} />
    </Screen>
  );
}
