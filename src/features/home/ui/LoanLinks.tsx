import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText, spacing } from '@/core/ui';
import type { HomeCopy } from '../copy';
import { HomeAction } from './HomeAction';

type Loan = { id: number; name: string; currency: string; recurringId: number | null };
type Rule = { id: number; name: string; currency: string };

export function LoanLinks({
  loans,
  rules,
  copy,
  onLink,
}: {
  loans: readonly Loan[];
  rules: readonly Rule[];
  copy: HomeCopy;
  onLink: (loanId: number, recurringId: number | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const loan = loans.find((item) => item.id === selected);
  const save = (recurringId: number | null) => {
    if (!loan) return;
    try {
      onLink(loan.id, recurringId);
      setSelected(null);
      setError('');
    } catch {
      setError(copy.linkError);
    }
  };
  return (
    <View style={styles.stack}>
      <HomeAction
        title={expanded ? copy.cancel : copy.reviewLinks}
        onPress={() => {
          setExpanded(!expanded);
          setSelected(null);
          setError('');
        }}
      />
      {expanded ? (
        <>
          <AppText color="textSecondary">{copy.linkHint}</AppText>
          {loan ? (
            <>
              <AppText variant="heading">{loan.name}</AppText>
              {rules
                .filter(
                  (rule) =>
                    rule.currency === loan.currency &&
                    !loans.some((other) => other.id !== loan.id && other.recurringId === rule.id),
                )
                .map((rule) => (
                  <HomeAction
                    key={rule.id}
                    title={rule.name}
                    hint={`${copy.linkRule} · ${rule.currency}`}
                    onPress={() => save(rule.id)}
                  />
                ))}
              <HomeAction title={copy.unlink} onPress={() => save(null)} />
            </>
          ) : (
            loans.map((item) => (
              <HomeAction
                key={item.id}
                title={item.name}
                hint={`${item.currency} · ${rules.find((rule) => rule.id === item.recurringId)?.name ?? copy.unlinked}`}
                onPress={() => setSelected(item.id)}
              />
            ))
          )}
          {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: spacing.sm } });
