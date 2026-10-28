import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { schema, useDb } from '@/core/db';
import { AppText, Card, ListRow, Screen, useTheme } from '@/core/ui';
import type { ThemePreference } from '@/core/ui/theme/preferences';
import { useCaptureRefresh } from '@/features/capture';
import { APP_LOCK_TIMEOUT_MINUTES, useAppLock } from '@/features/app-lock';

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
  const { colors, preference, setPreference } = useTheme();
  const db = useDb();
  const refresh = useCaptureRefresh();
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
      <AppText variant="heading">{t('settings.appearance')}</AppText>
      <AppText color="textSecondary">{t('settings.themeHint')}</AppText>
      <Card>
        {THEMES.map((theme) => (
          <ListRow
            key={theme}
            title={t(`settings.${theme}`)}
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
      <AppText variant="heading">{t('settings.appLock.sectionTitle')}</AppText>
      <AppText color="textSecondary">{t('settings.appLock.hint')}</AppText>
      <Card>
        <ListRow
          title={t('settings.appLock.title')}
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
    </Screen>
  );
}
