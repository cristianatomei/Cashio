import type { TransactionView } from './views';
import { summarize } from './grouping';

const PALETTE = ['#4338CA', '#0F766E', '#B45309', '#BE185D', '#1D4ED8', '#7E22CE'];

export function merchantIdentity(name: string): { initials: string; color: string } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toUpperCase();
  let hash = 0;
  for (const letter of name.trim().toLowerCase())
    hash = (hash * 31 + (letter.codePointAt(0) ?? 0)) >>> 0;
  return { initials: initials || '?', color: PALETTE[hash % PALETTE.length] };
}

/** Never add nominal EUR/RON amounts together or label them all as the base currency. */
export function dailyCurrencyTotals(
  rows: readonly Pick<TransactionView, 'currency' | 'type' | 'status' | 'amountMinor'>[],
) {
  return [...new Set(rows.map((row) => row.currency))].sort().map((currency) => ({
    currency,
    ...summarize(rows.filter((row) => row.currency === currency)),
  }));
}
