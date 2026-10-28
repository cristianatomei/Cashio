import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { useDb } from '@/core/db';
import { AppText, useTheme } from '@/core/ui';
import { spacing } from '@/core/ui/theme';

import { loadAppLockSettings, saveAppLockSettings, type AppLockSettings } from '../data/settings';
import { shouldLockAfterBackground } from '../domain/timeout';

type AppLockContextValue = {
  settings: AppLockSettings;
  updateSettings: (settings: AppLockSettings) => void;
  authenticate: () => Promise<boolean>;
};

const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

export function useAppLock(): AppLockContextValue {
  const context = useContext(AppLockContext);
  if (!context) throw new Error('useAppLock must be used within AppLockProvider');
  return context;
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [settings, setSettings] = useState(() => loadAppLockSettings(db));
  const [locked, setLocked] = useState(() => settings.enabled);
  const [covering, setCovering] = useState(false);
  const [authenticationFailed, setAuthenticationFailed] = useState(false);
  const authenticating = useRef(false);
  const settingsRef = useRef(settings);

  const updateSettings = useCallback(
    (next: AppLockSettings) => {
      saveAppLockSettings(db, next);
      settingsRef.current = next;
      setSettings(next);
      if (!next.enabled) {
        setLocked(false);
        setCovering(false);
        setAuthenticationFailed(false);
      }
    },
    [db],
  );

  const authenticate = useCallback(async () => {
    if (authenticating.current) return false;
    authenticating.current = true;
    setAuthenticationFailed(false);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('settings.appLock.unlockPrompt'),
        cancelLabel: t('common.cancel'),
        fallbackLabel: t('settings.appLock.devicePasscode'),
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLocked(false);
        setCovering(false);
        return true;
      }
      setAuthenticationFailed(true);
      return false;
    } catch (error) {
      console.error('App authentication failed', error);
      setAuthenticationFailed(true);
      return false;
    } finally {
      authenticating.current = false;
    }
  }, [t]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!locked || AppState.currentState !== 'active') return;
    const timer = setTimeout(() => void authenticate(), 0);
    return () => clearTimeout(timer);
  }, [authenticate, locked]);

  useEffect(() => {
    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const enabled = settingsRef.current.enabled;
      if (nextState === 'inactive') {
        if (enabled) setCovering(true);
      } else if (nextState === 'background') {
        if (enabled) {
          backgroundedAt = Date.now();
          setCovering(true);
        }
      } else if (nextState === 'active') {
        if (enabled && backgroundedAt !== null) {
          const elapsedMs = Date.now() - backgroundedAt;
          if (shouldLockAfterBackground(enabled, elapsedMs, settingsRef.current.timeoutMinutes)) {
            setLocked(true);
            setCovering(true);
          } else {
            setCovering(false);
          }
        } else {
          setCovering(false);
        }
        backgroundedAt = null;
      }
    });
    return () => subscription.remove();
  }, []);

  const showLockScreen = settings.enabled && (locked || covering);

  return (
    <AppLockContext.Provider value={{ settings, updateSettings, authenticate }}>
      {children}
      {showLockScreen ? (
        <View
          accessibilityViewIsModal
          style={[styles.overlay, { backgroundColor: colors.background }]}
        >
          <View style={styles.content}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
            <AppText variant="title" style={styles.centered}>
              {t('settings.appLock.lockedTitle')}
            </AppText>
            <AppText color="textSecondary" style={styles.centered}>
              {authenticationFailed
                ? t('settings.appLock.authFailed')
                : t('settings.appLock.lockedHint')}
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void authenticate()}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: colors.primary,
                  borderColor: pressed ? colors.textSecondary : colors.primary,
                },
              ]}
            >
              <AppText variant="heading" color="onPrimary" style={styles.centered}>
                {t('settings.appLock.unlock')}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </AppLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  content: { alignItems: 'center', gap: spacing.lg },
  centered: { textAlign: 'center' },
  button: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
});
