import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { AppText, spacing, useTheme } from '@/core/ui';

export function SwipeDraftRow({
  children,
  disabled,
  onConfirm,
  onIgnore,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onConfirm: () => void;
  onIgnore: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [offset] = useState(() => new Animated.Value(0));
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !disabled && Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderMove: (_event, gesture) =>
          offset.setValue(Math.max(-120, Math.min(120, gesture.dx))),
        onPanResponderRelease: (_event, gesture) => {
          Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start();
          if (disabled) return;
          if (gesture.dx > 90) onConfirm();
          else if (gesture.dx < -90) onIgnore();
        },
        onPanResponderTerminate: () =>
          Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [disabled, onConfirm, onIgnore, offset],
  );
  return (
    <View style={styles.root}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.hints}>
        <AppText>{t('workflows.confirm')}</AppText>
        <AppText>{t('workflows.ignore')}</AppText>
      </View>
      <Animated.View
        {...responder.panHandlers}
        style={{ transform: [{ translateX: offset }], backgroundColor: colors.background }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  hints: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
});
