import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, SheetModal, spacing } from '@/core/ui';
import { CategoryPickerModal } from '@/features/categories';
import { AccountPickerModal } from '@/features/accounts';
import { useTags } from '@/features/tags';

import type { BatchAction } from '../data/workflowsRepo';

type Props = {
  count: number;
  inbox?: boolean;
  disabled: boolean;
  onApply: (action: BatchAction) => void;
  onSelectAll: () => void;
  onClear: () => void;
};

export function BatchToolbar({ count, inbox, disabled, onApply, onSelectAll, onClear }: Props) {
  const { t } = useTranslation();
  const [picker, setPicker] = useState<'category' | 'account' | 'tags' | null>(null);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const tags = useTags();
  return (
    <View style={styles.root}>
      <AppText>{t('workflows.selected', { count })}</AppText>
      <View style={styles.row}>
        <Chip label={t('workflows.selectAll')} onPress={onSelectAll} />
        <Chip label={t('common.cancel')} onPress={onClear} />
      </View>
      {count > 0 && !disabled ? (
        <>
          <View style={styles.row}>
            <Chip label={t('transactions.filterCategory')} onPress={() => setPicker('category')} />
            {!inbox ? (
              <>
                <Chip
                  label={t('transactions.filterAccount')}
                  onPress={() => setPicker('account')}
                />
                <Chip
                  label={t('workflows.addTags')}
                  onPress={() => {
                    setTagIds([]);
                    setPicker('tags');
                  }}
                />
              </>
            ) : null}
          </View>
          {inbox ? (
            <Button title={t('workflows.confirm')} onPress={() => onApply({ kind: 'confirm' })} />
          ) : null}
          <Button
            title={t(inbox ? 'workflows.ignore' : 'common.delete')}
            variant="danger"
            onPress={() => onApply({ kind: 'delete' })}
          />
        </>
      ) : null}
      {picker === 'category' ? (
        <CategoryPickerModal
          selectedId={null}
          onSelect={(categoryId) => {
            if (categoryId !== null) onApply({ kind: 'category', categoryId });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'account' ? (
        <AccountPickerModal
          selectedId={null}
          onSelect={(accountId) => {
            if (accountId !== null) onApply({ kind: 'account', accountId });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'tags' ? (
        <SheetModal visible title={t('workflows.addTags')} onClose={() => setPicker(null)}>
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.name}
              selected={tagIds.includes(tag.id)}
              onPress={() =>
                setTagIds((value) =>
                  value.includes(tag.id) ? value.filter((id) => id !== tag.id) : [...value, tag.id],
                )
              }
            />
          ))}
          <Button
            disabled={!tagIds.length}
            title={t('common.save')}
            onPress={() => {
              onApply({ kind: 'tags', tagIds });
              setPicker(null);
            }}
          />
        </SheetModal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
