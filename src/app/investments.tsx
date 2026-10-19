import { desc, eq } from 'drizzle-orm';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { schema, useDb } from '@/core/db';
import {
  AppText,
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
  SheetModal,
  TextField,
  confirmDestructive,
  useTheme,
} from '@/core/ui';
import { useCaptureRefresh } from '@/features/capture';
import {
  INVESTMENT_ASSETS_SETTING,
  parseInvestmentAssets,
  parseInvestmentNotification,
  saveInvestmentAssets,
  type InvestmentAsset,
  type InvestmentAssetKind,
} from '@/features/investments';
import { DEFAULT_CAPTURE_SOURCES } from '@/features/capture/domain/sources';

export default function InvestmentsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const db = useDb();
  const refresh = useCaptureRefresh();
  const { data: settings } = useLiveQuery(
    db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, INVESTMENT_ASSETS_SETTING)),
  );
  const { data: notifications } = useLiveQuery(
    db
      .select()
      .from(schema.rawNotifications)
      .where(eq(schema.rawNotifications.packageName, 'com.revolut.revolut'))
      .orderBy(desc(schema.rawNotifications.postedAt))
      .limit(100),
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [kind, setKind] = useState<InvestmentAssetKind>('crypto');
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';

  const assetState = useMemo(() => {
    try {
      return { assets: parseInvestmentAssets(settings[0]?.value), loadError: false };
    } catch (error) {
      console.error('Failed to read tracked investment assets', error);
      return { assets: [], loadError: true };
    }
  }, [settings]);
  const { assets, loadError } = assetState;

  useEffect(() => {
    if (loadError) Alert.alert(t('errors.generic'), t('investments.loadError'));
  }, [loadError, t]);

  const movementNotifications = useMemo(
    () =>
      notifications.flatMap((notification) => {
        const sourceName =
          DEFAULT_CAPTURE_SOURCES.find((source) => source.packageName === notification.packageName)
            ?.name ?? '';
        const movement = parseInvestmentNotification(
          sourceName,
          notification.title,
          notification.body,
          assets,
        );
        return movement ? [{ ...notification, movement }] : [];
      }),
    [assets, notifications],
  );

  const symbolValid = /^[A-Z0-9.-]{2,12}$/.test(symbol.trim().toUpperCase());
  const canSave = name.trim().length > 0 && symbolValid && !loadError;

  const persistAssets = (nextAssets: InvestmentAsset[]) => {
    try {
      saveInvestmentAssets(db, nextAssets);
    } catch (error) {
      console.error('Failed to save tracked investment assets', error);
      Alert.alert(t('errors.generic'), t('investments.saveError'));
    }
  };

  const addAsset = () => {
    if (!canSave) return;
    const asset: InvestmentAsset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      kind,
    };
    persistAssets([...assets, asset]);
    setName('');
    setSymbol('');
    setKind('crypto');
    setEditing(false);
  };

  const removeAsset = (asset: InvestmentAsset) =>
    confirmDestructive({
      title: t('dialogs.deleteTitle'),
      message: t('investments.removeBody', { name: asset.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => persistAssets(assets.filter((item) => item.id !== asset.id)),
    });

  return (
    <Screen title={t('investments.title')} onRefresh={refresh}>
      <AppText color="textSecondary">{t('investments.hint')}</AppText>
      <SectionHeader title={t('investments.assets')} />
      <Button title={t('investments.add')} onPress={() => setEditing(true)} disabled={loadError} />
      {assets.length === 0 ? (
        <Card>
          <AppText color="textSecondary">{t('investments.emptyAssets')}</AppText>
        </Card>
      ) : (
        <Card>
          {assets.map((asset) => (
            <ListRow
              key={asset.id}
              title={asset.name}
              subtitle={`${asset.symbol} · ${t(`investments.kind.${asset.kind}`)}`}
              leading={<Ionicons name="trending-up-outline" size={24} color={colors.primary} />}
              trailing={<Ionicons name="trash-outline" size={20} color={colors.expense} />}
              onPress={() => removeAsset(asset)}
            />
          ))}
          <AppText variant="caption" color="textMuted">
            {t('investments.removeHint')}
          </AppText>
        </Card>
      )}

      <SectionHeader title={t('investments.alerts')} />
      {movementNotifications.length === 0 ? (
        <Card>
          <AppText color="textSecondary">{t('investments.emptyAlerts')}</AppText>
        </Card>
      ) : (
        <Card>
          {movementNotifications.map(({ id, title, body, postedAt, movement }) => (
            <ListRow
              key={id}
              title={`${movement.asset.name} (${movement.asset.symbol})`}
              subtitle={[
                t(
                  movement.direction === 'up'
                    ? 'investments.movementUp'
                    : 'investments.movementDown',
                  {
                    percent:
                      movement.changePercent === null
                        ? ''
                        : ` ${new Intl.NumberFormat(locale, {
                            maximumFractionDigits: 2,
                          }).format(movement.changePercent)}%`,
                  },
                ),
                new Date(postedAt).toLocaleString(locale),
                title,
                body,
              ]
                .filter(Boolean)
                .join(' · ')}
              leading={
                <Ionicons
                  name={
                    movement.direction === 'up'
                      ? 'arrow-up-circle-outline'
                      : 'arrow-down-circle-outline'
                  }
                  size={24}
                  color={movement.direction === 'up' ? colors.income : colors.expense}
                />
              }
            />
          ))}
        </Card>
      )}

      <AppText variant="caption" color="textMuted">
        {t('investments.noAdvice')}
      </AppText>
      {editing ? (
        <SheetModal
          visible
          title={t('investments.add')}
          onClose={() => setEditing(false)}
          footer={<Button title={t('common.save')} onPress={addAsset} disabled={!canSave} />}
        >
          <TextField label={t('investments.assetName')} value={name} onChangeText={setName} />
          <TextField
            label={t('investments.symbol')}
            value={symbol}
            onChangeText={(value) => setSymbol(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
          />
          <SegmentedControl
            value={kind}
            onChange={setKind}
            options={[
              { value: 'crypto', label: t('investments.kind.crypto') },
              { value: 'stock', label: t('investments.kind.stock') },
              { value: 'other', label: t('investments.kind.other') },
            ]}
          />
        </SheetModal>
      ) : null}
    </Screen>
  );
}
