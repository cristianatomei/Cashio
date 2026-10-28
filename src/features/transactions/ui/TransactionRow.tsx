import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText, AppText, CategoryIcon, ListRow, useTheme } from '@/core/ui';
import { merchantIdentity } from '../domain/merchantIdentity';

import { transactionTitle, type TransactionView } from '../domain/views';

type Props = { view: TransactionView; onPress?: () => void };

export function TransactionRow({ view, onPress }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const merchantName = view.merchant?.name ?? view.merchantRaw;
  const identity = merchantName ? merchantIdentity(merchantName) : null;

  const time = new Date(view.occurredAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const details = [
    view.merchant && view.allocations.length > 0
      ? [
          ...new Set(
            view.allocations.map((allocation) => allocation.category?.name).filter(Boolean),
          ),
        ].join(', ')
      : null,
    ...view.tags.map((tag) => `#${tag.name}`),
    time,
    view.status === 'draft' ? t('transactions.draft') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ListRow
      title={transactionTitle(view)}
      subtitle={details}
      leading={
        view.type === 'transfer' ? (
          <Ionicons name="swap-horizontal" size={24} color={colors.primary} style={styles.icon} />
        ) : identity ? (
          <View accessible={false} style={[styles.avatar, { backgroundColor: identity.color }]}>
            <AppText style={styles.initials}>{identity.initials}</AppText>
          </View>
        ) : (
          <CategoryIcon
            name={view.category?.icon ?? 'help-circle-outline'}
            color={view.category?.color ?? colors.textMuted}
          />
        )
      }
      trailing={
        <AmountText
          amountMinor={view.amountMinor}
          currency={view.currency}
          type={view.type === 'transfer' ? 'neutral' : view.type}
        />
      }
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  icon: { width: 40, textAlign: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#FFFFFF', fontWeight: '700' },
});
