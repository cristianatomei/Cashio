export const PUBLIC_RATES_URL =
  'https://api.frankfurter.dev/v2/rates?base=EUR&quotes=RON,USD,GBP&providers=ECB';
export const FX_CURRENCIES = ['RON', 'EUR', 'USD', 'GBP'] as const;
export const FX_OPT_IN_KEY = 'public_fx_enabled';
export const FX_STALE_DAYS = 4;

export type PublicRate = {
  currency: string;
  rateToBase: number;
  effectiveAt: number;
  source: string;
};

export function parsePublicRates(
  payload: unknown,
  baseCurrency: string,
  now = Date.now(),
): PublicRate[] {
  if (!FX_CURRENCIES.some((currency) => currency === baseCurrency)) {
    throw new Error('unsupported-base');
  }
  if (!Array.isArray(payload) || payload.length !== 3) throw new Error('invalid-response');
  const quotes = new Map<string, number>([['EUR', 1]]);
  let date: string | undefined;
  for (const row of payload) {
    if (
      typeof row !== 'object' ||
      row === null ||
      row.base !== 'EUR' ||
      !['RON', 'USD', 'GBP'].includes(row.quote) ||
      quotes.has(row.quote) ||
      typeof row.rate !== 'number' ||
      !Number.isFinite(row.rate) ||
      row.rate <= 0 ||
      typeof row.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      (date !== undefined && date !== row.date)
    ) {
      throw new Error('invalid-response');
    }
    date = row.date;
    quotes.set(row.quote, row.rate);
  }
  const start = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(start) ||
    new Date(start).toISOString().slice(0, 10) !== date ||
    start > now
  ) {
    throw new Error('invalid-date');
  }
  // End of the published day: never apply a reference quote before its publication.
  const effectiveAt = start + 86_400_000 - 1;
  const base = quotes.get(baseCurrency)!;
  for (const quote of quotes.values()) {
    if (!Number.isFinite(base / quote) || base / quote <= 0) throw new Error('invalid-response');
  }
  return [...quotes].flatMap(([currency, quote]) =>
    currency === baseCurrency
      ? []
      : [
          {
            currency,
            rateToBase: base / quote,
            effectiveAt,
            source: `frankfurter:ECB:${baseCurrency}`,
          },
        ],
  );
}

export function isRateStale(effectiveAt: number, now = Date.now()): boolean {
  return now - effectiveAt > FX_STALE_DAYS * 86_400_000;
}

export async function fetchPublicRates(
  enabled: boolean,
  baseCurrency: string,
  request: typeof fetch = fetch,
): Promise<PublicRate[]> {
  if (!enabled) throw new Error('opt-in-required');
  if (!FX_CURRENCIES.some((currency) => currency === baseCurrency)) {
    throw new Error('unsupported-base');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await request(PUBLIC_RATES_URL, {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('provider-unavailable');
    return parsePublicRates(await response.json(), baseCurrency);
  } finally {
    clearTimeout(timeout);
  }
}
