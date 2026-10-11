import { eq } from 'drizzle-orm';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Switch, View } from 'react-native';

import { schema, useDb } from '@/core/db';
import {
  AmountText,
  AppText,
  Button,
  Card,
  ProgressBar,
  Screen,
  SectionHeader,
  confirmDestructive,
  useTheme,
} from '@/core/ui';
import { addMonths, startOfMonth } from '@/core/utils/dates';
import { formatMinor } from '@/core/utils/money';
import {
  BudgetFormModal,
  deleteBudget,
  setBudgetAlertsEnabled,
  useBudgetViews,
  type BudgetView,
} from '@/features/budgets';
import { MonthSwitcher } from '@/features/transactions';
import { useCaptureRefresh } from '@/features/capture';

export default function BudgetsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const db = useDb();
  const refresh = useCaptureRefresh();
  const [month, setMonth] = useState(() => startOfMonth(Date.now()));
  const [editing, setEditing] = useState<BudgetView | null | undefined>(undefined);
  const { data: alertSetting } = useLiveQuery(
    db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'budget_alerts_enabled')),
  );
  const alertsEnabled = alertSetting[0]?.value === 'true';
  const budgets = useBudgetViews(month);
  const nextMonth = addMonths(month, 1);
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';

  const setAlerts = async (enabled: boolean) => {
    try {
      const granted = await setBudgetAlertsEnabled(db, enabled);
      if (!granted)
        Alert.alert(t('budgets.alertPermissionTitle'), t('budgets.alertPermissionBody'));
    } catch (error) {
      console.error('Failed to change budget alerts', error);
      Alert.alert(t('errors.generic'), t('budgets.notificationError'));
    }
  };

  const remove = (budget: BudgetView) =>
    confirmDestructive({
      title: t('dialogs.deleteTitle'),
      message: t('dialogs.deleteBody', { name: budget.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => deleteBudget(db, budget.id),
    });

  return (
    <Screen title={t('budgets.title')} onRefresh={refresh}>
      <MonthSwitcher monthStart={month} onChange={setMonth} />
      <Card>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <AppText variant="heading">{t('budgets.alerts')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('budgets.alertsHint')}
            </AppText>
          </View>
          <Switch
            value={alertsEnabled}
            onValueChange={(enabled) => void setAlerts(enabled)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </Card>

      <SectionHeader title={t('budgets.monthly')} />
      <Button title={t('budgets.add')} onPress={() => setEditing(null)} />
      {budgets.length === 0 ? (
        <Card>
          <AppText color="textSecondary">{t('budgets.empty')}</AppText>
        </Card>
      ) : (
        budgets.map((budget) => {
          const remaining = budget.limitMinor - budget.spentMinor;
          return (
            <Card key={budget.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="speedometer-outline" size={24} color={colors.primary} />
                <AppText variant="heading" style={{ flex: 1 }}>
                  {budget.name}
                </AppText>
                <AmountText
                  amountMinor={budget.spentMinor}
                  currency={budget.currency}
                  type="expense"
                />
              </View>
              <ProgressBar value={budget.progress} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="caption" color="textSecondary">
                  {t('budgets.limit', {
                    amount: formatMinor(budget.limitMinor, budget.currency, locale),
                  })}
                </AppText>
                <AppText variant="caption" color={remaining < 0 ? 'expense' : 'textSecondary'}>
                  {t('budgets.remaining', {
                    amount: formatMinor(remaining, budget.currency, locale),
                  })}
                </AppText>
              </View>
              {budget.rollover ? (
                <AppText variant="caption" color="textMuted">
                  {t('budgets.rolloverIncluded', {
                    amount: formatMinor(budget.carriedMinor, budget.currency, locale),
                  })}
                </AppText>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  title={t('common.edit')}
                  onPress={() => setEditing(budget)}
                  variant="secondary"
                />
                <Button
                  title={t('common.delete')}
                  onPress={() => remove(budget)}
                  variant="danger"
                />
              </View>
            </Card>
          );
        })
      )}

      {editing !== undefined ? (
        <BudgetFormModal budget={editing ?? undefined} onClose={() => setEditing(undefined)} />
      ) : null}
      <AppText variant="caption" color="textMuted">
        {t('budgets.periodHint', {
          from: new Date(month).toLocaleDateString(locale),
          to: new Date(nextMonth - 1).toLocaleDateString(locale),
        })}
      </AppText>
    </Screen>
  );
}
