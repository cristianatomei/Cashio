export type MerchantAlias = {
  id: number;
  merchantId: number;
  rawPattern: string;
  matchType: 'exact' | 'contains';
};

/** Exact match wins; otherwise the longest "contains" pattern. Both sides must be normalized. */
export function matchAlias(
  normalizedMerchant: string,
  aliases: readonly MerchantAlias[],
): MerchantAlias | null {
  if (!normalizedMerchant) return null;

  const exact = aliases.find(
    (alias) => alias.matchType === 'exact' && alias.rawPattern === normalizedMerchant,
  );
  if (exact) return exact;

  let best: MerchantAlias | null = null;
  for (const alias of aliases) {
    if (alias.matchType !== 'contains' || !alias.rawPattern) continue;
    if (!normalizedMerchant.includes(alias.rawPattern)) continue;
    if (!best || alias.rawPattern.length > best.rawPattern.length) best = alias;
  }
  return best;
}
