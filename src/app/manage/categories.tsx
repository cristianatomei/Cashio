import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  CategoryIcon,
  ListRow,
  Screen,
  SegmentedControl,
  spacing,
  useTheme,
} from '@/core/ui';
import {
  CategoryFormModal,
  GroupFormModal,
  useTaxonomy,
  type Category,
  type Group,
} from '@/features/categories';
import { useCaptureRefresh } from '@/features/capture';

type Editor =
  | { type: 'group'; group?: Group }
  | { type: 'category'; groupId: number; category?: Category }
  | null;

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const refresh = useCaptureRefresh();
  const { colors } = useTheme();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const groups = useTaxonomy({ kind, includeArchived: true });
  const [editor, setEditor] = useState<Editor>(null);

  return (
    <Screen topInset={false} onRefresh={refresh}>
      <Stack.Screen options={{ title: t('categories.title') }} />
      <SegmentedControl
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: t('categories.expensesTab') },
          { value: 'income', label: t('categories.incomeTab') },
        ]}
      />
      <Button title={t('categories.addGroup')} onPress={() => setEditor({ type: 'group' })} />

      {groups.map((group) => (
        <Card key={group.id} style={group.archived ? styles.archived : undefined}>
          <View style={styles.groupHeader}>
            <CategoryIcon name={group.icon} color={group.color} />
            <Pressable style={styles.groupTitle} onPress={() => setEditor({ type: 'group', group })}>
              <AppText variant="heading">{group.name}</AppText>
              {group.archived ? (
                <AppText variant="caption" color="textMuted">
                  {t('common.archivedLabel')}
                </AppText>
              ) : null}
            </Pressable>
            <Pressable
              hitSlop={12}
              onPress={() => setEditor({ type: 'category', groupId: group.id })}
            >
              <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
            </Pressable>
          </View>
          {group.categories.length === 0 ? (
            <AppText variant="caption" color="textMuted">
              {t('categories.emptyGroup')}
            </AppText>
          ) : null}
          {group.categories.map((category) => (
            <ListRow
              key={category.id}
              title={category.name}
              subtitle={category.archived ? t('common.archivedLabel') : undefined}
              leading={
                <CategoryIcon
                  name={category.icon}
                  color={category.archived ? '#94A3B8' : group.color}
                  size={32}
                />
              }
              onPress={() => setEditor({ type: 'category', groupId: group.id, category })}
            />
          ))}
        </Card>
      ))}

      {editor?.type === 'group' ? (
        <GroupFormModal kind={kind} group={editor.group} onClose={() => setEditor(null)} />
      ) : null}
      {editor?.type === 'category' ? (
        <CategoryFormModal
          kind={kind}
          groupId={editor.groupId}
          category={editor.category}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupTitle: { flex: 1 },
  archived: { opacity: 0.6 },
});
