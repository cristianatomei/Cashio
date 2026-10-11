import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button as NativeButton, StyleSheet, View } from 'react-native';

import { useCaptureInbox } from '@/features/capture';
import { AppText, Button, Card, Screen, SegmentedControl, spacing } from '@/core/ui';
import { NotificationListener } from '@modules/notification-listener';

type Filter = 'open' | 'closed' | 'all';

export default function CapturedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { notifications, accessGranted, refresh, setReviewStatus } = useCaptureInbox();
  const [filter, setFilter] = useState<Filter>('open');
  const visible = notifications.filter(
    (item) => filter === 'all' || (filter === 'open' ? item.reviewStatus === 'open' : item.reviewStatus !== 'open'),
  );

  return (
    <Screen topInset={false} onRefresh={refresh}>
      <AppText variant="heading">{accessGranted ? t('captured.accessOn') : t('captured.accessOff')}</AppText>
      {!accessGranted && (
        <NativeButton
          title={t('captured.grant')}
          onPress={() => NotificationListener.openAccessSettings()}
        />
      )}
      <NativeButton title={t('captured.refresh')} onPress={() => void refresh()} />
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: t('captured.open') },
          { value: 'closed', label: t('captured.closed') },
          { value: 'all', label: t('captured.all') },
        ]}
      />
      {visible.length === 0 ? (
        <AppText color="textSecondary">{t('captured.empty')}</AppText>
      ) : (
        visible.map((item) => (
          <Card key={item.id}>
            <AppText variant="caption" color="textMuted">
              {item.packageName} · {new Date(item.postedAt).toLocaleString()} · {t(`captured.status.${item.reviewStatus}`)}
            </AppText>
            {item.title ? <AppText variant="heading">{item.title}</AppText> : null}
            <AppText>{item.body}</AppText>
            <View style={styles.actions}>
              {item.transactionId !== null ? (
                <Button
                  title={t('captured.openTransaction')}
                  onPress={() => router.push({ pathname: '/add-transaction', params: { id: String(item.transactionId) } })}
                  variant="secondary"
                />
              ) : null}
              {item.reviewStatus === 'open' ? (
                <>
                  <Button
                    title={t('captured.markHandled')}
                    onPress={() => setReviewStatus(item.id, 'handled')}
                    variant="secondary"
                  />
                  <Button
                    title={t('captured.ignore')}
                    onPress={() => setReviewStatus(item.id, 'ignored')}
                    variant="secondary"
                  />
                </>
              ) : (
                <Button
                  title={t('captured.reopen')}
                  onPress={() => setReviewStatus(item.id, 'open')}
                  variant="secondary"
                />
              )}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
