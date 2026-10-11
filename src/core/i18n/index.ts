import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Language } from '@/core/db';

import { en } from './locales/en';
import { ro } from './locales/ro';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['ro', 'en'];

export function detectLanguage(): Language {
  return getLocales()[0]?.languageCode === 'en' ? 'en' : 'ro';
}

export function currentLanguage(): Language {
  return i18next.language === 'en' ? 'en' : 'ro';
}

const instance = i18next;

export const i18nReady = instance.use(initReactI18next).init({
  resources: { ro: { translation: ro }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: 'ro',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export { i18next };
