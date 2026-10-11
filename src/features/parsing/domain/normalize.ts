/** Lowercase, diacritics-free text with company suffixes and long codes removed, for comparisons. */
export function normalizeMerchant(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?|romania|ro)(?=\s|$|[.,*])/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title-cases shouting merchant names ("KAUFLAND BUC" becomes "Kaufland Buc"). */
export function prettifyMerchant(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}

/** A readable merchant name to offer when creating one from a raw notification name. */
export function suggestMerchantName(raw: string): string {
  const withoutSuffix = raw.replace(/\s*\b(?:s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?)\.?\s*$/i, '');
  return prettifyMerchant(withoutSuffix || raw);
}
