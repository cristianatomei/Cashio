import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, CategoryIcon, SheetModal, spacing, useTheme } from '@/core/ui';

import { useTaxonomy } from '../data/queries';

type Props = {
  kind: 'expense' | 'income';
  selectedId: number | null;
  onSelect: (categoryId: number) => void;
  onClose: () => void;
  /** Adds a "none" option, for places where a category is optional. */
  onClear?: () => void;
};

export function CategoryPickerModal({ kind, selectedId, onSelect, onClose, onClear }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const groups = useTaxonomy({ kind });

  return (
    <SheetModal visible title={t('categories.pick')} onClose={onClose}>
      {onClear ? (
        <Pressable
          onPress={() => {
            onClear();
            onClose();
          }}
        >
          <AppText color="textSecondary">{t('common.none')}</AppText>
        </Pressable>
      ) : null}
      {groups.map((group) => (
        <View key={group.id} style={styles.group}>
          <AppText variant="caption" color="textMuted">
            {group.name.toUpperCase()}
          </AppText>
          <View style={styles.grid}>
            {group.categories.map((category) => {
              const selected = category.id === selectedId;
              return (
                <Pressable
                  key={category.id}
                  style={[
                    styles.tile,
                    selected && { backgroundColor: `${group.color}26`, borderColor: group.color },
                    { borderColor: selected ? group.color : 'transparent' },
                  ]}
                  onPress={() => {
                    onSelect(category.id);
                    onClose();
                  }}
                >
                  <CategoryIcon name={category.icon} color={group.color} />
                  <AppText variant="caption" style={{ color: colors.text, textAlign: 'center' }}>
                    {category.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '23%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
});
