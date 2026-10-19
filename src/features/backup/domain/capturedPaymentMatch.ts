import { normalizeMerchant } from '@/features/parsing';
import type { IngTransactionRow } from './ingCsv';

export type ExistingCapturedPayment = {
  type: string;
  amountMinor: number;
  currency: string;
  merchantRaw: string | null;
};

function descriptionsMatch(imported: string, captured: string): boolean {
  const importedNormalized = normalizeMerchant(imported);
  const capturedNormalized = normalizeMerchant(captured);
  if (importedNormalized.length < 4 || capturedNormalized.length < 4) return false;
  return (
    importedNormalized === capturedNormalized ||
    importedNormalized.includes(capturedNormalized) ||
    capturedNormalized.includes(importedNormalized)
  );
}

export function matchesCapturedPayment(
  row: IngTransactionRow,
  existing: ExistingCapturedPayment,
): boolean {
  const type = row.amountMinor < 0 ? 'expense' : 'income';
  return (
    existing.type === type &&
    existing.amountMinor === Math.abs(row.amountMinor) &&
    existing.currency === row.currency &&
    existing.merchantRaw !== null &&
    descriptionsMatch(row.description, existing.merchantRaw)
  );
}
