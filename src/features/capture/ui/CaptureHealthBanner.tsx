import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { AppText, Card, ListRow, useTheme } from '@/core/ui';
import { NotificationListener } from '@modules/notification-listener';

import type { CaptureHealthStatus } from '../domain/health';

export function CaptureHealthBanner({ status }: { status: CaptureHealthStatus }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (!status) return null;

  const title =
    status.kind === 'permission-lost'
      ? t('home.capturePermissionLost')
      : t('home.captureInactive', { days: status.days });

  return (
    <Card>
      <ListRow
        title={title}
        subtitle={t('home.captureHealthHint')}
        leading={<Ionicons name="warning-outline" size={26} color={colors.warning} />}
        trailing={
          <AppText variant="caption" color="primary">
            {t('home.captureFix')}
          </AppText>
        }
        onPress={() => NotificationListener.openAccessSettings()}
      />
    </Card>
  );
}
