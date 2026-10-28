import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, minimumTouchTarget, radius, useTheme } from '@/core/ui';

export default function TabsLayout() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const measurementKey = `${width}:${fontScale}:${i18n.language}`;
  const [measurement, setMeasurement] = useState({ key: measurementKey, height: 0 });
  const labelHeight = Math.max(
    16 * fontScale,
    measurement.key === measurementKey ? measurement.height : 0,
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarAllowFontScaling: true,
        tabBarLabelPosition: 'below-icon',
        tabBarItemStyle: { minHeight: minimumTouchTarget, minWidth: minimumTouchTarget },
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          height: Math.max(64, 44 + labelHeight) + insets.bottom,
        },
        tabBarLabel: ({ color, children }) => (
          <AppText
            variant="caption"
            style={[styles.label, { color }]}
            onLayout={({ nativeEvent }) => {
              const height = Math.ceil(nativeEvent.layout.height);
              setMeasurement((current) =>
                current.key === measurementKey && current.height >= height
                  ? current
                  : {
                      key: measurementKey,
                      height: Math.max(current.key === measurementKey ? current.height : 0, height),
                    },
              );
            }}
          >
            {children}
          </AppText>
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t('tabs.transactions'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t('tabs.add'),
          tabBarAccessibilityLabel: t('tabs.add'),
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={[styles.addButton, { backgroundColor: colors.primary }]}>
              <Ionicons name="add" size={28} color={colors.onPrimary} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push('/add-transaction');
          },
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.stats'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pie-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('tabs.more'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { alignSelf: 'stretch', textAlign: 'center' },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
