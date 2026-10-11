/** Parses "1.234,56" or "1234.56" into minor units (123456). Returns null if not a number. */
export function parseAmountToMinor(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;

  const lastSep = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  const hasDecimals = lastSep !== -1 && cleaned.length - lastSep - 1 <= 2;
  const integerPart = (hasDecimals ? cleaned.slice(0, lastSep) : cleaned).replace(/[.,]/g, '');
  const decimalPart = hasDecimals ? cleaned.slice(lastSep + 1).padEnd(2, '0') : '00';

  return Number(integerPart) * 100 + Number(decimalPart);
}

export function formatMinor(minor: number, currency: string, locale = 'ro-RO'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}

/** Like parseAmountToMinor but accepts a leading minus and treats an empty string as zero. */
export function parseSignedAmountToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return 0;
  const negative = trimmed.startsWith('-');
  const minor = parseAmountToMinor(negative ? trimmed.slice(1) : trimmed);
  if (minor === null) return null;
  return negative ? -minor : minor;
}

/** Plain "1234.50" text for editing an amount. */
export function minorToInput(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
