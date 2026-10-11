import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { useDb } from '@/core/db';

import { darkColors, lightColors, type ThemeColors } from './palette';
import {
  loadThemePreference,
  resolveThemeScheme,
  saveThemePreference,
  type ThemePreference,
} from './preferences';

type Theme = {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<Theme | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const [preference, setStoredPreference] = useState(() => loadThemePreference(db));
  const systemScheme = useColorScheme();
  const scheme = resolveThemeScheme(preference, systemScheme);
  const setPreference = useCallback(
    (next: ThemePreference) => {
      saveThemePreference(db, next);
      setStoredPreference(next);
    },
    [db],
  );

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
    return () => Appearance.setColorScheme('unspecified');
  }, [preference]);

  const value = useMemo<Theme>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used within ThemeProvider');
  return theme;
}
