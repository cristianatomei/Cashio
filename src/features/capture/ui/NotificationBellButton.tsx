import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, minimumTouchTarget, spacing, useTheme } from '@/core/ui';

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
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.primarySoft : 'transparent' },
      ]}
    >
      <Ionicons name="notifications-outline" size={26} color={colors.text} />
      {count > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.badge, { backgroundColor: colors.expense }]}
        >
          <AppText variant="caption" color="onPrimary" style={styles.badgeText}>
            {count > 99 ? '99+' : count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: minimumTouchTarget,
    minHeight: minimumTouchTarget,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: minimumTouchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 18,
    minHeight: 18,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 14 },
});
