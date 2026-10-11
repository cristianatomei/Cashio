import { parseAmountToMinor } from '@/core/utils/money';

const CURRENCY_SYMBOLS: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', LEI: 'RON' };

const CURRENCY = '(RON|EUR|USD|GBP|LEI|€|\\$|£)';
const NUMBER = '(\\d[\\d.,]*)';
const AMOUNT_PATTERN = new RegExp(
  `${CURRENCY}\\s*${NUMBER}|${NUMBER}\\s*${CURRENCY}`,
  'i',
);

export type ExtractedAmount = { amountMinor: number; currency: string };

/** Finds the first money amount in free text, e.g. "45,20 RON", "RON 45.20" or "€12.50". */
export function extractAmount(text: string): ExtractedAmount | null {
  const match = AMOUNT_PATTERN.exec(text);
  if (!match) return null;

  const rawCurrency = (match[1] ?? match[4]).toUpperCase();
  const rawNumber = (match[2] ?? match[3]).replace(/[.,]+$/, '');
  const amountMinor = parseAmountToMinor(rawNumber);
  if (amountMinor === null || amountMinor <= 0) return null;

  return { amountMinor, currency: CURRENCY_SYMBOLS[rawCurrency] ?? rawCurrency };
}
