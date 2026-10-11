import { useTranslation } from 'react-i18next';

import { formatMinor } from '@/core/utils/money';

import { AppText } from './AppText';
import type { TextVariant } from '../theme';

type Props = {
  amountMinor: number;
  currency: string;
  /** Colors the amount and prefixes a sign; 'neutral' leaves it plain. */
  type?: 'income' | 'expense' | 'neutral';
  variant?: TextVariant;
};

export function AmountText({ amountMinor, currency, type = 'neutral', variant = 'body' }: Props) {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'ro-RO';
  const sign = type === 'expense' ? '-' : type === 'income' ? '+' : '';
  const color = type === 'neutral' ? 'text' : type;
  // Neutral amounts keep their own sign (e.g. a day total or a negative balance).
  const value = type === 'neutral' ? amountMinor : Math.abs(amountMinor);

  return (
    <AppText variant={variant} color={color} style={{ fontVariant: ['tabular-nums'] }}>
      {sign}
      {formatMinor(value, currency, locale)}
    </AppText>
  );
}
