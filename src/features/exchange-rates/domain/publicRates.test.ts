import { fetchPublicRates, isRateStale, parsePublicRates, PUBLIC_RATES_URL } from './publicRates';

const payload = [
  { date: '2026-10-23', base: 'EUR', quote: 'RON', rate: 5 },
  { date: '2026-10-23', base: 'EUR', quote: 'USD', rate: 1.25 },
  { date: '2026-10-23', base: 'EUR', quote: 'GBP', rate: 0.8 },
];

describe('public FX', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-28T12:00:00Z'));
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('cross-converts only public reference rates and tags their base', () => {
    const rates = parsePublicRates(payload, 'RON');
    expect(rates.find((row) => row.currency === 'USD')).toEqual({
      currency: 'USD',
      rateToBase: 4,
      effectiveAt: Date.parse('2026-10-23T23:59:59.999Z'),
      source: 'frankfurter:ECB:RON',
    });
    expect(rates.find((row) => row.currency === 'RON')).toBeUndefined();
    expect(parsePublicRates(payload, 'USD').find((row) => row.currency === 'RON')?.rateToBase).toBe(
      0.25,
    );
  });
  it.each(
    [
      null,
      {},
      [],
      [...payload, payload[0]],
      [payload[0], payload[0], payload[2]],
      payload.map((row) => ({ ...row, rate: 0 })),
      payload.map((row) => ({ ...row, rate: Infinity })),
      payload.map((row) => ({ ...row, date: '2026-02-30' })),
      payload.map((row) => ({ ...row, date: '2099-01-01' })),
      [payload[0], { ...payload[1], date: '2026-10-22' }, payload[2]],
      payload.map((row) => ({ ...row, base: 'USD' })),
    ].map((input) => [input]),
  )('rejects invalid provider data %#', (input) => {
    expect(() => parsePublicRates(input, 'RON')).toThrow();
  });
  it('never sends a request without opt-in or for an unsupported base', async () => {
    const request = jest.fn();
    await expect(fetchPublicRates(false, 'RON', request)).rejects.toThrow('opt-in-required');
    await expect(fetchPublicRates(true, 'XXX', request)).rejects.toThrow('unsupported-base');
    expect(request).not.toHaveBeenCalled();
  });
  it('uses the same fixed public request regardless of user base, without a body or credentials', async () => {
    const request = jest.fn().mockResolvedValue({ ok: true, json: async () => payload });
    await fetchPublicRates(true, 'RON', request);
    await fetchPublicRates(true, 'GBP', request);
    for (const [url, options] of request.mock.calls) {
      expect(url).toBe(PUBLIC_RATES_URL);
      expect(options).toMatchObject({ method: 'GET', credentials: 'omit' });
      expect(options.body).toBeUndefined();
    }
  });
  it('surfaces network, HTTP and schema errors', async () => {
    await expect(
      fetchPublicRates(true, 'RON', jest.fn().mockRejectedValue(new Error('offline'))),
    ).rejects.toThrow('offline');
    await expect(
      fetchPublicRates(true, 'RON', jest.fn().mockResolvedValue({ ok: false })),
    ).rejects.toThrow('provider-unavailable');
    await expect(
      fetchPublicRates(
        true,
        'RON',
        jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
      ),
    ).rejects.toThrow('invalid-response');
  });
  it('marks cached rates stale after four days', () => {
    expect(isRateStale(1000, 1000 + 4 * 86_400_000)).toBe(false);
    expect(isRateStale(1000, 1001 + 4 * 86_400_000)).toBe(true);
  });
});
