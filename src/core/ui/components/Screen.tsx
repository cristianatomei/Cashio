import type { ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = {
  title?: string;
  /** Pass false when the navigator already renders a header. */
  topInset?: boolean;
  children: ReactNode;
  headerAction?: ReactNode;
  onRefresh?: () => void | Promise<void>;
};

export function Screen({ title, topInset = true, children, headerAction, onRefresh }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Screen refresh failed', error);
      Alert.alert(t('errors.generic'), t('common.refreshError'));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: (topInset ? insets.top : 0) + spacing.lg },
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.background}
            />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {title ? (
          <View style={styles.titleRow}>
            <AppText variant="title" accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
            {headerAction}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, marginBottom: spacing.sm },
});
