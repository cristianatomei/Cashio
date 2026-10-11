import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useDb } from '@/core/db';
import {
  AppText,
  Button,
  ColorSwatches,
  IconGrid,
  SheetModal,
  TextField,
  confirmDestructive,
  swatchColors,
} from '@/core/ui';

import {
  deleteGroup,
  saveGroup,
  setGroupArchived,
} from '../data/categoriesRepo';
import { CATEGORY_ICONS } from '../domain/icons';
import type { Group } from '../domain/taxonomy';

type Props = { kind: Group['kind']; group?: Group; onClose: () => void };

export function GroupFormModal({ kind, group, onClose }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const [name, setName] = useState(group?.name ?? '');
  const [color, setColor] = useState(group?.color ?? swatchColors[0]);
  const [icon, setIcon] = useState(group?.icon ?? CATEGORY_ICONS[0]);

  const save = () => {
    if (!name.trim()) return;
    saveGroup(db, { id: group?.id, name, kind, color, icon });
    onClose();
  };

  const remove = () => {
    if (!group) return;
    confirmDestructive({
      title: t('dialogs.deleteTitle'),
      message: t('dialogs.deleteBody', { name: group.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        if (deleteGroup(db, group.id)) onClose();
        else Alert.alert(t('dialogs.groupNotEmptyTitle'), t('dialogs.groupNotEmptyBody'));
      },
    });
  };

  return (
    <SheetModal
      visible
      title={group ? t('categories.editGroup') : t('categories.addGroup')}
      onClose={onClose}
      footer={<Button title={t('common.save')} onPress={save} disabled={!name.trim()} />}
    >
      <TextField label={t('categories.groupName')} value={name} onChangeText={setName} />
      <AppText variant="caption" color="textSecondary">
        {t('common.color')}
      </AppText>
      <ColorSwatches value={color} onChange={setColor} />
      <AppText variant="caption" color="textSecondary">
        {t('common.icon')}
      </AppText>
      <IconGrid icons={CATEGORY_ICONS} value={icon} color={color} onChange={setIcon} />
      {group ? (
        <>
          <Button
            variant="secondary"
            title={group.archived ? t('common.unarchive') : t('common.archive')}
            onPress={() => {
              setGroupArchived(db, group.id, !group.archived);
              onClose();
            }}
          />
          <Button variant="danger" title={t('common.delete')} onPress={remove} />
        </>
      ) : null}
    </SheetModal>
  );
}
