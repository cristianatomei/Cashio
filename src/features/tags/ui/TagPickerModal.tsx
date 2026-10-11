import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { useDb } from '@/core/db';
import { Button, Chip, SheetModal, TextField, spacing } from '@/core/ui';

import { findOrCreateTag } from '../data/tagsRepo';
import { useTags } from '../data/queries';

type Props = {
  selectedIds: number[];
  onChange: (tagIds: number[]) => void;
  onClose: () => void;
};

export function TagPickerModal({ selectedIds, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const tags = useTags();
  const [name, setName] = useState('');

  const toggle = (id: number) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const create = () => {
    if (!name.trim()) return;
    try {
      const id = findOrCreateTag(db, name);
      if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
      setName('');
    } catch {
      Alert.alert(t('errors.generic'));
    }
  };

  return (
    <SheetModal
      visible
      title={t('tags.pick')}
      onClose={onClose}
      footer={<Button title={t('common.done')} onPress={onClose} />}
    >
      <View style={styles.row}>
        <View style={styles.input}>
          <TextField
            value={name}
            onChangeText={setName}
            placeholder={t('tags.newPlaceholder')}
            onSubmitEditing={create}
            returnKeyType="done"
          />
        </View>
        <Button title={t('common.add')} onPress={create} variant="secondary" />
      </View>
      <View style={styles.chips}>
        {tags.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.name}
            color={tag.color ?? undefined}
            selected={selectedIds.includes(tag.id)}
            onPress={() => toggle(tag.id)}
          />
        ))}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  input: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
