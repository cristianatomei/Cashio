import { Stack } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { DATABASE_NAME, migrate, seedDefaults, useDb } from '@/core/db';
import { currentLanguage, i18nReady, i18next } from '@/core/i18n';
import { ThemeProvider, useTheme } from '@/core/ui';
import { useCaptureSync } from '@/features/capture';
import { syncLoanScheduleReminders } from '@/features/loans/data/loanReminders';

async function initializeDatabase(db: SQLiteDatabase) {
  try {
    await i18nReady;
    await migrate(db);
    const savedLanguage = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      ['language'],
    );
    if (savedLanguage?.value === 'ro' || savedLanguage?.value === 'en') {
      await i18next.changeLanguage(savedLanguage.value);
    }
    await seedDefaults(db, currentLanguage());
  } catch (error) {
    console.error('Database initialization failed', error);
    throw error;
  }
}

function RootStack() {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const db = useDb();
  useCaptureSync();

  useEffect(() => {
    let leftForeground = false;
    const syncReminders = () => {
      void syncLoanScheduleReminders(db, {
        title: t('recurring.reminderTitle'),
        body: (name) => t('recurring.reminderBody', { name }),
      }).catch((error: unknown) => {
        console.error('Failed to refresh loan payment reminders', error);
      });
    };
    syncReminders();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        leftForeground = true;
      } else if (leftForeground) {
        leftForeground = false;
        syncReminders();
      }
    });
    return () => subscription.remove();
  }, [db, i18n.language, t]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="captured" options={{ title: t('captured.title') }} />
        <Stack.Screen name="inbox" options={{ title: t('inbox.title') }} />
        <Stack.Screen name="recurring" options={{ title: t('recurring.title') }} />
        <Stack.Screen name="investments" options={{ title: t('investments.title') }} />
        <Stack.Screen name="budgets" options={{ title: t('budgets.title') }} />
        <Stack.Screen name="data" options={{ title: t('data.title') }} />
        <Stack.Screen name="settings" options={{ title: t('more.settings') }} />
        <Stack.Screen
          name="add-transaction"
          options={{ title: t('form.newTitle'), presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onInit={initializeDatabase}
      options={{ enableChangeListener: true }}
    >
      <ThemeProvider>
        <RootStack />
      </ThemeProvider>
    </SQLiteProvider>
  );
}
