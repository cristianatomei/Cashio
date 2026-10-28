import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';

import { schema, useDb } from '@/core/db';
import { AppText, Card, ListRow, Screen, useTheme } from '@/core/ui';
import type { ThemePreference } from '@/core/ui/theme/preferences';
import { useCaptureRefresh } from '@/features/capture';
import {
  backupSettingKeys,
  chooseBackupFolder,
  runScheduledBackup,
  saveBackupSetting,
} from '@/features/backup';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGES = ['ro', 'en'] as const;

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const db = useDb();
  const sqlite = useSQLiteContext();
  const { data: appSettings } = useLiveQuery(db.select().from(schema.appSettings));
  const refresh = useCaptureRefresh();
  const backupFrequency =
    appSettings.find((setting) => setting.key === backupSettingKeys.frequency)?.value === 'weekly'
      ? 'weekly'
      : 'daily';
  const backupRetention =
    appSettings.find((setting) => setting.key === backupSettingKeys.retention)?.value ?? '10';
  const backupFolderSelected = appSettings.some(
    (setting) => setting.key === backupSettingKeys.folder && setting.value.length > 0,
  );

  const selectTheme = (next: ThemePreference) => {
    try {
      setPreference(next);
    } catch (error) {
      console.error('Failed to save theme preference', error);
      Alert.alert(t('errors.generic'), t('settings.saveError'));
    }
  };

  const selectBackupFrequency = (frequency: 'daily' | 'weekly') => {
    void saveBackupSetting(sqlite, backupSettingKeys.frequency, frequency).catch((error: unknown) => {
      console.error('Failed to save backup frequency', error);
      Alert.alert(t('errors.generic'), t('settings.backupSaveError'));
    });
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
