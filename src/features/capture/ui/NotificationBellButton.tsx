import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, useTheme } from '@/core/ui';

import { useOpenNotificationCount } from './useOpenNotificationCount';

export function NotificationBellButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const count = useOpenNotificationCount();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('captured.unreadCount', { count })}
      onPress={() => router.push('/captured')}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.65 : 1 }]}
      hitSlop={8}
    >
      <Ionicons name="notifications-outline" size={26} color={colors.text} />
      {count > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.expense }]}>
          <AppText variant="caption" color="onPrimary" style={styles.badgeText}>
            {count > 99 ? '99+' : count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 14 },
});
