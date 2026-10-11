import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { schema, useDb } from '@/core/db';
import { AppText, Card, ListRow, Screen, useTheme } from '@/core/ui';
import type { ThemePreference } from '@/core/ui/theme/preferences';
import { useCaptureRefresh } from '@/features/capture';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGES = ['ro', 'en'] as const;

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const db = useDb();
  const refresh = useCaptureRefresh();

  const selectTheme = (next: ThemePreference) => {
    try {
      setPreference(next);
    } catch (error) {
      console.error('Failed to save theme preference', error);
      Alert.alert(t('errors.generic'), t('settings.saveError'));
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
