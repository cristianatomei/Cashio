import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Card, ListRow, Screen, useTheme } from '@/core/ui';
import { useCaptureRefresh } from '@/features/capture';

type Href =
  | '/captured'
  | '/inbox'
  | '/manage/accounts'
  | '/manage/categories'
  | '/manage/merchants'
  | '/manage/tags'
  | '/settings'
  | '/data'
  | '/recurring'
  | '/budgets';

type Entry = {
  key:
    | 'inbox'
    | 'accounts'
    | 'categories'
    | 'merchants'
    | 'budgets'
    | 'recurring'
    | 'tags'
    | 'captured'
    | 'settings'
    | 'data';
  icon: keyof typeof Ionicons.glyphMap;
  href?: Href;
};

const ENTRIES: readonly Entry[] = [
  { key: 'inbox', icon: 'filter-outline', href: '/inbox' },
  { key: 'accounts', icon: 'wallet-outline', href: '/manage/accounts' },
  { key: 'categories', icon: 'grid-outline', href: '/manage/categories' },
  { key: 'merchants', icon: 'storefront-outline', href: '/manage/merchants' },
  { key: 'budgets', icon: 'speedometer-outline', href: '/budgets' },
  { key: 'recurring', icon: 'repeat-outline', href: '/recurring' },
  { key: 'tags', icon: 'pricetag-outline', href: '/manage/tags' },
  { key: 'captured', icon: 'notifications-outline', href: '/captured' },
  { key: 'data', icon: 'cloud-download-outline', href: '/data' },
  { key: 'settings', icon: 'settings-outline', href: '/settings' },
];

export default function MoreScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const refresh = useCaptureRefresh();

  return (
    <Screen title={t('more.title')} onRefresh={refresh}>
      <Card>
        {ENTRIES.map(({ key, icon, href }) => (
          <ListRow
            key={key}
            title={t(`more.${key}`)}
            leading={<Ionicons name={icon} size={22} color={colors.primary} />}
            trailing={
              href ? (
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              ) : (
                <AppText variant="caption" color="textMuted">
                  {t('more.comingSoon')}
                </AppText>
              )
            }
            onPress={href ? () => router.push(href) : undefined}
          />
        ))}
      </Card>
    </Screen>
  );
}
