export type InvestmentAssetKind = 'crypto' | 'stock' | 'other';

export type InvestmentAsset = {
  id: string;
  name: string;
  symbol: string;
  kind: InvestmentAssetKind;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAssetKind(value: unknown): value is InvestmentAssetKind {
  return value === 'crypto' || value === 'stock' || value === 'other';
}

export function parseInvestmentAssets(value: string | null | undefined): InvestmentAsset[] {
  if (value === null || value === undefined) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('The investment asset list is invalid.');

  const assets: InvestmentAsset[] = [];
  const ids = new Set<string>();
  for (const item of parsed) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      item.id.trim() === '' ||
      typeof item.name !== 'string' ||
      item.name.trim() === '' ||
      typeof item.symbol !== 'string' ||
      !/^[A-Z0-9.-]{2,12}$/.test(item.symbol) ||
      !isAssetKind(item.kind) ||
      ids.has(item.id)
    ) {
      throw new Error('The investment asset list contains an invalid asset.');
    }
    ids.add(item.id);
    assets.push({
      id: item.id,
      name: item.name.trim(),
      symbol: item.symbol,
      kind: item.kind,
    });
  }
  return assets;
}
