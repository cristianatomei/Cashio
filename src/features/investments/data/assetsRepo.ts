import { schema, type AppDb } from '@/core/db';

import { parseInvestmentAssets, type InvestmentAsset } from '../domain/assets';

export const INVESTMENT_ASSETS_SETTING = 'investment_assets';

export function saveInvestmentAssets(db: AppDb, assets: readonly InvestmentAsset[]): void {
  const serialized = JSON.stringify(assets);
  parseInvestmentAssets(serialized);
  db.insert(schema.appSettings)
    .values({ key: INVESTMENT_ASSETS_SETTING, value: serialized })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: serialized },
    })
    .run();
}
