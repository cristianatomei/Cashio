import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DEFAULT_CURRENCY, schema, useDb } from '@/core/db';
import { AppText, Button, Card, ListRow, Screen, useTheme } from '@/core/ui';
import { setAccountArchived, useAccounts } from '@/features/accounts';
import { applyCaptureSources } from '@/features/capture';
import { NotificationListener } from '@modules/notification-listener';

import { canArchiveAccount, saveOnboardingCompleted } from '@/features/onboarding';

const CURRENCIES = ['RON', 'EUR', 'USD', 'GBP'] as const;
const LANGUAGES = ['ro', 'en'] as const;
const STEP_COUNT = 4;

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { revisit } = useLocalSearchParams<{ revisit?: string }>();
  const db = useDb();
  const { colors } = useTheme();
  const accounts = useAccounts({ includeArchived: true });
  const [step, setStep] = useState(0);
  const [accessGranted, setAccessGranted] = useState(() => NotificationListener.isAccessGranted());
  const [baseCurrency, setBaseCurrency] = useState(
    () =>
      db.select().from(schema.appSettings).where(eq(schema.appSettings.key, 'base_currency')).get()
        ?.value ?? DEFAULT_CURRENCY,
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setAccessGranted(NotificationListener.isAccessGranted());
    });
    return () => subscription.remove();
  }, []);

  const saveSetting = (key: string, value: string) => {
    db.insert(schema.appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.appSettings.key, set: { value } })
      .run();
  };

  const chooseLanguage = async (language: (typeof LANGUAGES)[number]) => {
    saveSetting('language', language);
    await i18n.changeLanguage(language);
  };

  const chooseCurrency = (currency: (typeof CURRENCIES)[number]) => {
    setBaseCurrency(currency);
    saveSetting('base_currency', currency);
  };

  const finish = () => {
    saveOnboardingCompleted(db);
    if (revisit === '1') router.back();
    else router.replace('/home');
  };

  const activeCount = accounts.filter((account) => !account.archived).length;

  return (
    <Screen topInset={false}>
      <AppText variant="caption" color="textMuted">
        {t('onboarding.step', { current: step + 1, total: STEP_COUNT })}
      </AppText>
      {step === 0 ? (
        <>
          <AppText variant="title">{t('onboarding.notificationsTitle')}</AppText>
          <AppText color="textSecondary">{t('onboarding.notificationsHint')}</AppText>
          <Card>
            <ListRow
              title={accessGranted ? t('captured.accessOn') : t('captured.accessOff')}
              trailing={
                <Ionicons
                  name={accessGranted ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={accessGranted ? colors.primary : colors.textMuted}
                />
              }
            />
            {Platform.OS === 'android' ? (
              <Button
                title={t('onboarding.grantAccess')}
                onPress={() => NotificationListener.openAccessSettings()}
                variant="secondary"
              />
            ) : null}
          </Card>
          <AppText variant="title">{t('onboarding.batteryTitle')}</AppText>
          <AppText color="textSecondary">{t('onboarding.batteryHint')}</AppText>
          <Card>
            <AppText variant="heading">{t('onboarding.samsungTitle')}</AppText>
            <AppText color="textSecondary">{t('onboarding.samsungSteps')}</AppText>
          </Card>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <AppText variant="title">{t('onboarding.accountsTitle')}</AppText>
          <AppText color="textSecondary">{t('onboarding.accountsHint')}</AppText>
          <Card>
            {accounts.map((account) => {
              const selected = !account.archived;
              return (
                <ListRow
                  key={account.id}
                  title={account.name}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${account.name}, ${account.currency}`}
                  accessibilityState={{ checked: selected }}
                  accessibilityHint={
                    selected && activeCount === 1 ? t('onboarding.keepOneAccount') : undefined
                  }
                  subtitle={account.currency}
                  trailing={
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                  }
                  onPress={() => {
                    if (account.archived && !selected) {
                      setAccountArchived(db, account.id, false);
                      applyCaptureSources(db);
                    } else if (canArchiveAccount(activeCount)) {
                      setAccountArchived(db, account.id, true);
                      applyCaptureSources(db);
                    }
                  }}
                />
              );
            })}
          </Card>
          {activeCount === 1 ? (
            <AppText color="textSecondary">{t('onboarding.keepOneAccount')}</AppText>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <AppText variant="title">{t('onboarding.currencyTitle')}</AppText>
          <AppText color="textSecondary">{t('onboarding.currencyHint')}</AppText>
          <Card>
            {CURRENCIES.map((currency) => (
              <ListRow
                key={currency}
                title={currency}
                accessibilityRole="radio"
                accessibilityLabel={currency}
                accessibilityState={{ checked: baseCurrency === currency }}
                subtitle={baseCurrency === currency ? t('common.selected') : undefined}
                trailing={
                  baseCurrency === currency ? (
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  ) : null
                }
                onPress={() => chooseCurrency(currency)}
              />
            ))}
          </Card>
          <AppText variant="title">{t('onboarding.languageTitle')}</AppText>
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
                onPress={() => void chooseLanguage(language)}
              />
            ))}
          </Card>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <AppText variant="title">{t('onboarding.readyTitle')}</AppText>
          <AppText color="textSecondary">{t('onboarding.readyHint')}</AppText>
        </>
      ) : null}

      {step > 0 ? (
        <Button
          title={t('onboarding.back')}
          onPress={() => setStep((current) => current - 1)}
          variant="secondary"
        />
      ) : null}
      <Button
        title={step === STEP_COUNT - 1 ? t('onboarding.finish') : t('onboarding.continue')}
        onPress={() => (step === STEP_COUNT - 1 ? finish() : setStep((current) => current + 1))}
      />
    </Screen>
  );
}
