import { and, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { schema, useDb } from '@/core/db';
import { AppText, Button, Card, ListRow, SectionHeader } from '@/core/ui';
import { CategoryPickerModal, useTaxonomy } from '@/features/categories';
import { useMerchants } from '@/features/merchants';

import { saveMerchantRule } from '../data/workflowsRepo';

export function MerchantRulesCard() {
  const { t } = useTranslation();
  const db = useDb();
  const { data: rules } = useLiveQuery(db.select().from(schema.merchantCategoryRules));
  const merchants = useMerchants();
  const groups = useTaxonomy({ includeArchived: true });
  const [editing, setEditing] = useState<(typeof rules)[number] | null>(null);
  const fail = (error: unknown) => {
    console.error('Merchant rule action failed', error);
    Alert.alert(t('errors.generic'), t('workflows.saveError'));
  };
  return (
    <>
      <SectionHeader title={t('workflows.rules')} />
      <AppText variant="caption">{t('workflows.rulesHint')}</AppText>
      {!rules.length ? <AppText>{t('workflows.noRules')}</AppText> : null}
      {rules.map((rule) => (
        <Card key={`${rule.merchantId}:${rule.type}`}>
          <ListRow
            title={merchants.find((merchant) => merchant.id === rule.merchantId)?.name ?? '?'}
            subtitle={`${t(`types.${rule.type}`)} · ${groups.flatMap((group) => group.categories).find((category) => category.id === rule.categoryId)?.name ?? '?'}`}
            onPress={() => setEditing(rule)}
          />
          <Button
            variant="secondary"
            title={t('common.delete')}
            onPress={() => {
              try {
                db.delete(schema.merchantCategoryRules)
                  .where(
                    and(
                      eq(schema.merchantCategoryRules.merchantId, rule.merchantId),
                      eq(schema.merchantCategoryRules.type, rule.type),
                    ),
                  )
                  .run();
              } catch (error) {
                fail(error);
              }
            }}
          />
        </Card>
      ))}
      {editing ? (
        <CategoryPickerModal
          kind={editing.type}
          selectedId={editing.categoryId}
          onSelect={(categoryId) => {
            try {
              saveMerchantRule(db, editing.merchantId, editing.type, categoryId, false);
            } catch (error) {
              fail(error);
            }
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
