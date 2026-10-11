import type { TransactionType } from '@/core/domain/transaction';

import type { Language } from '@/core/db';

export type KeywordRule = {
  /** Whole word (or words) looked up in the normalized notification text. */
  pattern: string;
  type: TransactionType;
  /** Category name per language; resolved against the user's own categories. */
  category?: Record<Language, string>;
};

// Order matters: the first rule that matches wins.
export const DEFAULT_KEYWORD_RULES: readonly KeywordRule[] = [
  { pattern: 'rata', type: 'expense', category: { ro: 'Rate', en: 'Loan installments' } },
  { pattern: 'rate', type: 'expense', category: { ro: 'Rate', en: 'Loan installments' } },
  { pattern: 'salariu', type: 'income', category: { ro: 'Salariu', en: 'Salary' } },
  { pattern: 'asigurare auto', type: 'expense', category: { ro: 'Asigurare auto', en: 'Car insurance' } },
  { pattern: 'rca', type: 'expense', category: { ro: 'Asigurare auto', en: 'Car insurance' } },
  { pattern: 'rovinieta', type: 'expense', category: { ro: 'Rovinietă și taxe', en: 'Road tax' } },
];

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First rule whose pattern appears as whole words in the text. */
export function classifyText(text: string, rules: readonly KeywordRule[]): KeywordRule | null {
  const haystack = ` ${normalizeText(text)} `;
  return rules.find((rule) => haystack.includes(` ${normalizeText(rule.pattern)} `)) ?? null;
}

export { normalizeText };
