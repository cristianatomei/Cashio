import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useDb } from '@/core/db';
import { AppText, Card, Screen, TextField, confirmDestructive } from '@/core/ui';
import { minorToInput, parseAmountToMinor } from '@/core/utils/money';
import { useGoals, usePlanningCurrency } from '@/features/planning/data/queries';
import { deleteGoal, saveGoal, type SavingsGoal } from '@/features/planning/data/repo';
import { GoalSummary } from '@/features/planning/ui/GoalSummary';
import { PlanningButton } from '@/features/planning/ui/PlanningButton';

export default function GoalsScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { data: goals, error, updatedAt } = useGoals();
  const baseCurrency = usePlanningCurrency();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('0');
  const edit = (goal?: SavingsGoal) => {
    setEditing(goal?.id ?? 'new');
    setName(goal?.name ?? '');
    setCurrency(goal?.currency ?? baseCurrency);
    setTarget(goal ? minorToInput(goal.targetMinor) : '');
    setCurrent(goal ? minorToInput(goal.currentMinor) : '0');
  };
  const targetMinor = parseAmountToMinor(target);
  const currentMinor = parseAmountToMinor(current);
  const valid =
    name.trim() &&
    /^[A-Z]{3}$/.test(currency) &&
    Number.isSafeInteger(targetMinor) &&
    targetMinor !== null &&
    targetMinor > 0 &&
    Number.isSafeInteger(currentMinor) &&
    currentMinor !== null &&
    currentMinor >= 0;
  const save = () => {
    if (!valid || targetMinor === null || currentMinor === null) return;
    try {
      saveGoal(
        db,
        { name, currency, targetMinor, currentMinor },
        typeof editing === 'number' ? editing : undefined,
      );
      setEditing(null);
    } catch {
      Alert.alert(t('errors.generic'), t('planning.saveError'));
    }
  };
  const remove = (goal: SavingsGoal) =>
    confirmDestructive({
      title: t('dialogs.deleteTitle'),
      message: t('planning.deleteGoal', { name: goal.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        try {
          deleteGoal(db, goal.id);
          if (editing === goal.id) setEditing(null);
        } catch {
          Alert.alert(t('errors.generic'), t('planning.saveError'));
        }
      },
    });
  return (
    <Screen title={t('planning.goals')} topInset={false}>
      <AppText color="textSecondary">{t('planning.goalsHint')}</AppText>
      {editing === null ? (
        <PlanningButton
          title={t('planning.addGoal')}
          onPress={() => edit()}
          disabled={!updatedAt || !!error}
        />
      ) : (
        <Card style={{ gap: 12 }}>
          <AppText variant="heading">
            {t(editing === 'new' ? 'planning.addGoal' : 'planning.editGoal')}
          </AppText>
          <TextField
            label={t('planning.name')}
            accessibilityLabel={t('planning.name')}
            value={name}
            onChangeText={setName}
          />
          <TextField
            label={t('planning.currency')}
            accessibilityLabel={t('planning.currency')}
            value={currency}
            onChangeText={(value) => setCurrency(value.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
          />
          <TextField
            label={t('planning.target')}
            accessibilityLabel={t('planning.target')}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('planning.current')}
            accessibilityLabel={t('planning.current')}
            value={current}
            onChangeText={setCurrent}
            keyboardType="decimal-pad"
          />
          <AppText color="textSecondary">{t('planning.goalValidation')}</AppText>
          <PlanningButton title={t('common.save')} onPress={save} disabled={!valid} />
          <PlanningButton title={t('common.cancel')} onPress={() => setEditing(null)} />
        </Card>
      )}
      {error || !updatedAt ? (
        <AppText>{t(error ? 'planning.loadError' : 'planning.loading')}</AppText>
      ) : !goals.length ? (
        <AppText>{t('planning.emptyGoals')}</AppText>
      ) : null}
      {goals.map((goal) => (
        <Card key={goal.id} style={{ gap: 12 }}>
          <GoalSummary goal={goal} />
          <PlanningButton
            title={t('planning.editNamed', { name: goal.name })}
            onPress={() => edit(goal)}
          />
          <PlanningButton
            title={t('planning.deleteNamed', { name: goal.name })}
            onPress={() => remove(goal)}
          />
        </Card>
      ))}
    </Screen>
  );
}
