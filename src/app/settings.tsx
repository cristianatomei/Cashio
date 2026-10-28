import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';
import { eq } from 'drizzle-orm';
import { Alert, Platform } from 'react-native';

import { schema, useDb } from '@/core/db';
import { AppText, Card, ListRow, Screen, useTheme } from '@/core/ui';
import type { ThemePreference } from '@/core/ui/theme/preferences';
import {
  CAPTURE_INACTIVITY_DAY_OPTIONS,
  parseCaptureInactivityDays,
  useCaptureRefresh,
} from '@/features/capture';
import {
  backupSettingKeys,
  chooseBackupFolder,
  runScheduledBackup,
  saveBackupSetting,
} from '@/features/backup';
import { APP_LOCK_TIMEOUT_MINUTES, useAppLock } from '@/features/app-lock';
import { ProductivitySettings } from '@/features/productivity/ui/ProductivitySettings';
import { PublicRatesSettings } from '@/features/exchange-rates/ui/PublicRatesSettings';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGES = ['ro', 'en'] as const;
const APP_LOCK_TIMEOUT_KEYS = {
  0: 'immediately',
  1: 'oneMinute',
  5: 'fiveMinutes',
  15: 'fifteenMinutes',
} as const;

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors, preference, setPreference } = useTheme();
  const db = useDb();
  const sqlite = useSQLiteContext();
  const { data: appSettings } = useLiveQuery(db.select().from(schema.appSettings));
  const refresh = useCaptureRefresh();
  const { data: captureSettings } = useLiveQuery(
    db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'capture_inactivity_days')),
  );
  const captureInactivityDays = parseCaptureInactivityDays(captureSettings[0]?.value);
  const backupFrequency =
    appSettings.find((setting) => setting.key === backupSettingKeys.frequency)?.value === 'weekly'
      ? 'weekly'
      : 'daily';
  const backupRetention =
    appSettings.find((setting) => setting.key === backupSettingKeys.retention)?.value ?? '10';
  const backupFolderSelected = appSettings.some(
    (setting) => setting.key === backupSettingKeys.folder && setting.value.length > 0,
  );
  const {
    settings: appLockSettings,
    updateSettings: updateAppLockSettings,
    authenticate,
  } = useAppLock();

  const selectTheme = (next: ThemePreference) => {
    try {
      setPreference(next);
    } catch (error) {
      console.error('Failed to save theme preference', error);
      Alert.alert(t('errors.generic'), t('settings.saveError'));
    }
  };

  const selectCaptureInactivityDays = (days: number) => {
    try {
      db.insert(schema.appSettings)
        .values({ key: 'capture_inactivity_days', value: String(days) })
        .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: String(days) } })
        .run();
    } catch (error) {
      console.error('Failed to save capture inactivity preference', error);
      Alert.alert(t('errors.generic'), t('settings.captureSaveError'));
    }
  };

  const selectBackupFrequency = (frequency: 'daily' | 'weekly') => {
    void saveBackupSetting(sqlite, backupSettingKeys.frequency, frequency).catch(
      (error: unknown) => {
        console.error('Failed to save backup frequency', error);
        Alert.alert(t('errors.generic'), t('settings.backupSaveError'));
      },
    );
  };

  const chooseBackupRetention = () => {
    Alert.alert(t('settings.backupRetention'), t('settings.backupRetentionHint'), [
      ...([5, 10, 20] as const).map((count) => ({
        text: t('settings.backupRetentionValue', { count }),
        onPress: () => {
          void saveBackupSetting(sqlite, backupSettingKeys.retention, String(count)).catch(
            (error: unknown) => {
              console.error('Failed to save backup retention', error);
              Alert.alert(t('errors.generic'), t('settings.backupSaveError'));
            },
          );
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const selectBackupFolder = async () => {
    try {
      const folderUri = await chooseBackupFolder();
      if (!folderUri) return;
      await saveBackupSetting(sqlite, backupSettingKeys.folder, folderUri);
      await saveBackupSetting(sqlite, backupSettingKeys.lastAt, '');
      await runScheduledBackup(sqlite);
    } catch (error) {
      console.error('Failed to choose backup folder', error);
      Alert.alert(t('errors.generic'), t('settings.backupFolderError'));
    }
  };

  const toggleAppLock = async () => {
    if (appLockSettings.enabled) {
      try {
        updateAppLockSettings({ ...appLockSettings, enabled: false });
      } catch (error) {
        console.error('Failed to disable app lock', error);
        Alert.alert(t('errors.generic'), t('settings.appLock.saveError'));
      }
      return;
    }

    if (!(await authenticate())) {
      Alert.alert(t('settings.appLock.setupFailedTitle'), t('settings.appLock.setupFailed'));
      return;
    }
    try {
      updateAppLockSettings({ ...appLockSettings, enabled: true });
    } catch (error) {
      console.error('Failed to enable app lock', error);
      Alert.alert(t('errors.generic'), t('settings.appLock.saveError'));
    }
  };

  const selectAppLockTimeout = (timeoutMinutes: number) => {
    try {
      updateAppLockSettings({ ...appLockSettings, timeoutMinutes });
    } catch (error) {
      console.error('Failed to save app lock timeout', error);
      Alert.alert(t('errors.generic'), t('settings.appLock.saveError'));
    }
  };

  const selectLanguage = async (language: (typeof LANGUAGES)[number]) => {
    try {
      db.insert(schema.appSettings)
        .values({ key: 'language', value: language })
        .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: language } })
        .run();
      await i18n.changeLanguage(language);
    } catch (error) {
      console.error('Failed to save language preference', error);
      Alert.alert(t('errors.generic'), t('settings.languageSaveError'));
    }
  };

  return (
    <Screen topInset={false} onRefresh={refresh}>
      <ProductivitySettings />
      <PublicRatesSettings />
      <AppText variant="heading">{t('settings.appearance')}</AppText>
      <AppText color="textSecondary">{t('settings.themeHint')}</AppText>
      <Card>
        {THEMES.map((theme) => (
          <ListRow
            key={theme}
            title={t(`settings.${theme}`)}
            accessibilityRole="radio"
            accessibilityLabel={t(`settings.${theme}`)}
            accessibilityState={{ checked: preference === theme }}
            subtitle={preference === theme ? t('common.selected') : undefined}
            trailing={
              preference === theme ? (
                <Ionicons name="checkmark" size={24} color={colors.primary} />
              ) : null
            }
            onPress={() => selectTheme(theme)}
          />
        ))}
      </Card>
      <AppText variant="heading">{t('settings.backup')}</AppText>
      <AppText color="textSecondary">{t('settings.backupHint')}</AppText>
      <Card>
        <ListRow
          title={t('settings.backupFrequency')}
          subtitle={t(
            backupFrequency === 'weekly'
              ? 'settings.backupFrequencies.weekly'
              : 'settings.backupFrequencies.daily',
          )}
          trailing={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
          onPress={() =>
            Alert.alert(t('settings.backupFrequency'), t('settings.backupFrequencyHint'), [
              {
                text: t('settings.backupFrequencies.daily'),
                onPress: () => selectBackupFrequency('daily'),
              },
              {
                text: t('settings.backupFrequencies.weekly'),
                onPress: () => selectBackupFrequency('weekly'),
              },
              { text: t('common.cancel'), style: 'cancel' },
            ])
          }
        />
        <ListRow
          title={t('settings.backupRetention')}
          subtitle={t('settings.backupRetentionValue', { count: backupRetention })}
          trailing={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
          onPress={chooseBackupRetention}
        />
        {Platform.OS === 'android' ? (
          <ListRow
            title={t('settings.backupFolder')}
            subtitle={
              backupFolderSelected
                ? t('settings.backupFolderSelected')
                : t('settings.backupFolderChoose')
            }
            trailing={<Ionicons name="folder-open-outline" size={22} color={colors.primary} />}
            onPress={() => void selectBackupFolder()}
          />
        ) : (
          <ListRow title={t('settings.backupFolder')} subtitle={t('settings.backupDocuments')} />
        )}
      </Card>
      <AppText variant="heading">{t('settings.appLock.sectionTitle')}</AppText>
      <AppText color="textSecondary">{t('settings.appLock.hint')}</AppText>
      <Card>
        <ListRow
          title={t('settings.appLock.title')}
          accessibilityRole="switch"
          accessibilityLabel={t('settings.appLock.title')}
          accessibilityState={{ checked: appLockSettings.enabled }}
          subtitle={
            appLockSettings.enabled ? t('settings.appLock.enabled') : t('settings.appLock.disabled')
          }
          trailing={
            appLockSettings.enabled ? (
              <Ionicons name="checkmark" size={24} color={colors.primary} />
            ) : null
          }
          onPress={() => void toggleAppLock()}
        />
        {appLockSettings.enabled ? (
          <>
            <ListRow title={t('settings.appLock.timeoutTitle')} />
            {APP_LOCK_TIMEOUT_MINUTES.map((timeoutMinutes) => (
              <ListRow
                key={timeoutMinutes}
                title={t(`settings.appLock.timeouts.${APP_LOCK_TIMEOUT_KEYS[timeoutMinutes]}`)}
                accessibilityRole="radio"
                accessibilityLabel={t(
                  `settings.appLock.timeouts.${APP_LOCK_TIMEOUT_KEYS[timeoutMinutes]}`,
                )}
                accessibilityState={{ checked: appLockSettings.timeoutMinutes === timeoutMinutes }}
                subtitle={
                  appLockSettings.timeoutMinutes === timeoutMinutes
                    ? t('common.selected')
                    : undefined
                }
                trailing={
                  appLockSettings.timeoutMinutes === timeoutMinutes ? (
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  ) : null
                }
                onPress={() => selectAppLockTimeout(timeoutMinutes)}
              />
            ))}
          </>
        ) : null}
      </Card>
      <AppText variant="heading">{t('settings.language')}</AppText>
      <AppText color="textSecondary">{t('settings.languageHint')}</AppText>
      <Card>
        {LANGUAGES.map((language) => (
          <ListRow
            key={language}
            title={t(`settings.languages.${language}`)}
            accessibilityRole="radio"
            accessibilityLabel={t(`settings.languages.${language}`)}
            accessibilityState={{ checked: i18n.resolvedLanguage === language }}
            subtitle={i18n.resolvedLanguage === language ? t('common.selected') : undefined}
            trailing={
              i18n.resolvedLanguage === language ? (
                <Ionicons name="checkmark" size={24} color={colors.primary} />
              ) : null
            }
            onPress={() => void selectLanguage(language)}
          />
        ))}
      </Card>
      <AppText variant="heading">{t('settings.captureMonitoring')}</AppText>
      <AppText color="textSecondary">{t('settings.captureMonitoringHint')}</AppText>
      <Card>
        {CAPTURE_INACTIVITY_DAY_OPTIONS.map((days) => (
          <ListRow
            key={days}
            title={t('settings.captureInactivityDays', { count: days })}
            accessibilityRole="radio"
            accessibilityLabel={t('settings.captureInactivityDays', { count: days })}
            accessibilityState={{ checked: captureInactivityDays === days }}
            subtitle={captureInactivityDays === days ? t('common.selected') : undefined}
            trailing={
              captureInactivityDays === days ? (
                <Ionicons name="checkmark" size={24} color={colors.primary} />
              ) : null
            }
            onPress={() => selectCaptureInactivityDays(days)}
          />
        ))}
      </Card>
      <AppText variant="heading">{t('onboarding.settingsTitle')}</AppText>
      <AppText color="textSecondary">{t('onboarding.settingsHint')}</AppText>
      <Card>
        <ListRow
          title={t('onboarding.title')}
          onPress={() => router.push('/onboarding?revisit=1')}
        />
      </Card>
    </Screen>
  );
}
