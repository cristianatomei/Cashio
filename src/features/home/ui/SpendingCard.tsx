import { useState, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { AmountText, AppText, Card, TextField, spacing } from '@/core/ui';
import { daysUntilPayday, parsePayday, type freeToSpend } from '../domain/freeToSpend';
import type { HomeCopy } from '../copy';
import { HomeAction } from './HomeAction';

export function SpendingCard({
  result,
  currency,
  paydayValue,
  now,
  copy,
  onSave,
  children,
}: {
  result: ReturnType<typeof freeToSpend>;
  currency: string;
  paydayValue: string;
  now: number;
  copy: HomeCopy;
  onSave: (value: string) => void;
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(paydayValue);
  const [error, setError] = useState('');
  const save = () => {
    const normalized = value.trim();
    if (daysUntilPayday(now, parsePayday(normalized)) === null) {
      setError(copy.invalidDate);
      return;
    }
    try {
      onSave(normalized);
      setError('');
      setEditing(false);
    } catch {
      setError(copy.saveError);
    }
  };
  return (
    <Card style={styles.card}>
      <AppText color="textSecondary">
        {result.dailyMinor === null ? copy.balance : copy.free}
      </AppText>
      <AmountText
        amountMinor={result.dailyMinor ?? result.balanceMinor}
        currency={currency}
        variant="display"
      />
      {result.days === null ? (
        <>
          <AppText variant="heading">{copy.setup}</AppText>
          <AppText color="textSecondary">{copy.setupHint}</AppText>
        </>
      ) : (
        <>
          <AppText>
            {copy.until}: {paydayValue} · {copy.days}: {result.days}
          </AppText>
          <View style={styles.metric}>
            <AppText style={styles.label} color="textSecondary">
              {copy.balance}
            </AppText>
            <AmountText amountMinor={result.balanceMinor} currency={currency} />
          </View>
          {result.complete ? (
            <>
              <View style={styles.metric}>
                <AppText style={styles.label} color="textSecondary">
                  {copy.reserved}
                </AppText>
                <AmountText amountMinor={result.reservedMinor} currency={currency} />
              </View>
              <View style={styles.metric}>
                <AppText style={styles.label} color="textSecondary">
                  {copy.available}
                </AppText>
                <AmountText amountMinor={result.availableMinor ?? 0} currency={currency} />
              </View>
            </>
          ) : null}
        </>
      )}
      {!result.complete ? <AppText accessibilityRole="alert">{copy.incomplete}</AppText> : null}
      {result.availableMinor !== null && result.availableMinor < 0 ? (
        <AppText accessibilityRole="alert">{copy.deficit}</AppText>
      ) : null}
      <AppText variant="caption" color="textSecondary">
        {copy.explanation}
      </AppText>
      {editing ? (
        <View style={styles.card}>
          <TextField
            label={copy.payday}
            accessibilityLabel={copy.payday}
            value={value}
            onChangeText={setValue}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
          <HomeAction title={copy.save} onPress={save} />
          <HomeAction title={copy.cancel} onPress={() => setEditing(false)} />
        </View>
      ) : (
        <HomeAction
          title={result.days === null ? copy.setPayday : copy.changePayday}
          onPress={() => {
            setValue(paydayValue);
            setError('');
            setEditing(true);
          }}
        />
      )}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  metric: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
});
