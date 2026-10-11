export function convertToBaseMinor(amountMinor: number, rateToBase: number): number | null {
  if (!Number.isSafeInteger(amountMinor) || !Number.isFinite(rateToBase) || rateToBase <= 0) {
    return null;
  }
  const converted = Math.round(amountMinor * rateToBase);
  return Number.isSafeInteger(converted) ? converted : null;
}
