import { desc, sql } from 'drizzle-orm';

import { exchangeRates } from '@/core/db/schema';

export function ratePreferenceOrder() {
  return [
    // Existing manual dates are local midnight; provider dates are explicitly UTC.
    desc(sql`CASE WHEN ${exchangeRates.source} = 'manual'
      THEN date(${exchangeRates.effectiveAt} / 1000, 'unixepoch', 'localtime')
      ELSE date(${exchangeRates.effectiveAt} / 1000, 'unixepoch') END`),
    desc(sql`${exchangeRates.source} = 'manual'`),
    desc(exchangeRates.effectiveAt),
  ];
}
