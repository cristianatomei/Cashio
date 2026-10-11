import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useDb } from '@/core/db';
import {
  AppText,
  Button,
  ColorSwatches,
  SheetModal,
  TextField,
  confirmDestructive,
  swatchColors,
} from '@/core/ui';

import { deleteTag, saveTag, type Tag } from '../data/tagsRepo';

type Props = { tag?: Tag; onClose: () => void };

export function TagFormModal({ tag, onClose }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState<string>(tag?.color ?? swatchColors[0]);

  const save = () => {
    if (!name.trim()) return;
    try {
      saveTag(db, { id: tag?.id, name, color });
      onClose();
    } catch {
      Alert.alert(t('dialogs.duplicateTitle'), t('dialogs.duplicateBody'));
    }
  };

  const remove = () => {
    if (!tag) return;
    confirmDestructive({
      title: t('dialogs.deleteTitle'),
      message: t('dialogs.deleteBody', { name: tag.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        deleteTag(db, tag.id);
        onClose();
      },
    });
  };

  return (
    <SheetModal
      visible
      title={tag ? t('tags.edit') : t('tags.add')}
      onClose={onClose}
      footer={<Button title={t('common.save')} onPress={save} disabled={!name.trim()} />}
    >
      <TextField label={t('common.name')} value={name} onChangeText={setName} />
      <AppText variant="caption" color="textSecondary">
        {t('common.color')}
      </AppText>
      <ColorSwatches value={color} onChange={setColor} />
      {tag ? <Button variant="danger" title={t('common.delete')} onPress={remove} /> : null}
    </SheetModal>
  );
}
