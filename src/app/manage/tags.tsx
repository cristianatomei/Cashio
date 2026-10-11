import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, EmptyState, ListRow, Screen } from '@/core/ui';
import { TagFormModal, useTags, type Tag } from '@/features/tags';
import { useCaptureRefresh } from '@/features/capture';

export default function TagsScreen() {
  const { t } = useTranslation();
  const refresh = useCaptureRefresh();
  const tags = useTags();
  const [editing, setEditing] = useState<Tag | 'new' | null>(null);

  return (
    <Screen topInset={false} onRefresh={refresh}>
      <Stack.Screen options={{ title: t('tags.title') }} />
      <Button title={t('tags.add')} onPress={() => setEditing('new')} />
      {tags.length === 0 ? (
        <EmptyState icon="pricetag-outline" title={t('tags.emptyTitle')} body={t('tags.emptyBody')} />
      ) : (
        <Card>
          {tags.map((tag) => (
            <ListRow
              key={tag.id}
              title={tag.name}
              subtitle={t('tags.usage', { count: tag.usage })}
              leading={<Ionicons name="pricetag" size={22} color={tag.color ?? '#94A3B8'} />}
              trailing={<AppText variant="caption" color="textMuted">{tag.usage}</AppText>}
              onPress={() => setEditing(tag)}
            />
          ))}
        </Card>
      )}
      {editing ? (
        <TagFormModal tag={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      ) : null}
    </Screen>
  );
}
