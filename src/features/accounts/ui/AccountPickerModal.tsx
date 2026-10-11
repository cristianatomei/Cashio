import { useTranslation } from 'react-i18next';

import { AmountText, CategoryIcon, ListRow, SheetModal } from '@/core/ui';

import { useAccountBalances, useAccounts } from '../data/queries';

type Props = {
  selectedId: number | null;
  /** Hides one account, e.g. the source when picking a transfer destination. */
  excludeId?: number | null;
  onSelect: (accountId: number) => void;
  onClear?: () => void;
  onClose: () => void;
};

export function AccountPickerModal({ selectedId, excludeId, onSelect, onClear, onClose }: Props) {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const balances = useAccountBalances();

  return (
    <SheetModal visible title={t('accounts.pick')} onClose={onClose}>
      {onClear ? (
        <ListRow
          title={t('common.none')}
          subtitle={selectedId === null ? t('common.selected') : undefined}
          onPress={() => {
            onClear();
            onClose();
          }}
        />
      ) : null}
      {accounts
        .filter((account) => account.id !== excludeId)
        .map((account) => (
          <ListRow
            key={account.id}
            title={account.name}
            subtitle={account.id === selectedId ? t('common.selected') : undefined}
            leading={<CategoryIcon name={account.icon} color={account.color} />}
            trailing={
              <AmountText amountMinor={balances.get(account.id) ?? 0} currency={account.currency} />
            }
            onPress={() => {
              onSelect(account.id);
              onClose();
            }}
          />
        ))}
    </SheetModal>
  );
}
