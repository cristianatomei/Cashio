import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useDb } from '@/core/db';
import {
  AppText,
  Button,
  Chip,
  IconGrid,
  SheetModal,
  TextField,
  confirmDestructive,
} from '@/core/ui';

import { useTaxonomy } from '../data/queries';
import {
  deleteCategory,
  saveCategory,
  setCategoryArchived,
} from '../data/categoriesRepo';
import { CATEGORY_ICONS } from '../domain/icons';
import type { Category, Group } from '../domain/taxonomy';

type Props = {
  kind: Group['kind'];
  /** Group the new category starts in. */
  groupId: number;
  category?: Category;
  onClose: () => void;
};

export function CategoryFormModal({ kind, groupId, category, onClose }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const groups = useTaxonomy({ kind, includeArchived: true });
  const [name, setName] = useState(category?.name ?? '');
  const [selectedGroupId, setSelectedGroupId] = useState(category?.groupId ?? groupId);
  const [icon, setIcon] = useState(category?.icon ?? CATEGORY_ICONS[0]);

  const color = groups.find((g) => g.id === selectedGroupId)?.color ?? '#94A3B8';

  const save = () => {
    if (!name.trim()) return;
    saveCategory(db, { id: category?.id, groupId: selectedGroupId, name, icon });
    onClose();
  };

  const remove = () => {
    if (!category) return;
    confirmDestructive({
      title: t('dialogs.deleteTitle'),
      message: t('dialogs.deleteBody', { name: category.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        if (deleteCategory(db, category.id)) onClose();
        else Alert.alert(t('dialogs.inUseTitle'), t('dialogs.inUseBody', { name: category.name }));
      },
    });
  };

  return (
    <SheetModal
      visible
      title={category ? t('categories.editCategory') : t('categories.addCategory')}
      onClose={onClose}
      footer={<Button title={t('common.save')} onPress={save} disabled={!name.trim()} />}
    >
      <TextField label={t('categories.categoryName')} value={name} onChangeText={setName} />
      <AppText variant="caption" color="textSecondary">
        {t('categories.group')}
      </AppText>
      {groups.map((group) => (
        <Chip
          key={group.id}
          label={group.name}
          color={group.color}
          selected={group.id === selectedGroupId}
          onPress={() => setSelectedGroupId(group.id)}
        />
      ))}
      <AppText variant="caption" color="textSecondary">
        {t('common.icon')}
      </AppText>
      <IconGrid icons={CATEGORY_ICONS} value={icon} color={color} onChange={setIcon} />
      {category ? (
        <>
          <Button
            variant="secondary"
            title={category.archived ? t('common.unarchive') : t('common.archive')}
            onPress={() => {
              setCategoryArchived(db, category.id, !category.archived);
              onClose();
            }}
          />
          <Button variant="danger" title={t('common.delete')} onPress={remove} />
        </>
      ) : null}
    </SheetModal>
  );
}
