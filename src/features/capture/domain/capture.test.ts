import { DEFAULT_KEYWORD_RULES, normalizeText } from '@/features/parsing';

import { matchAlias, type MerchantAlias } from './aliases';
import { dedupeHash, resolveCapture, type CaptureContext } from './resolve';

const alias = (
  id: number,
  merchantId: number,
  rawPattern: string,
  matchType: MerchantAlias['matchType'] = 'contains',
): MerchantAlias => ({ id, merchantId, rawPattern, matchType });

describe('matchAlias', () => {
  const aliases = [alias(1, 10, 'mega'), alias(2, 11, 'mega image'), alias(3, 12, 'xulescu', 'exact')];

  it('prefers the longest contains pattern', () => {
    expect(matchAlias('mega image buc', aliases)?.merchantId).toBe(11);
  });

  it('matches exact aliases only on equality', () => {
    expect(matchAlias('xulescu', aliases)?.merchantId).toBe(12);
    expect(matchAlias('xulescu 2', aliases)).toBeNull();
  });

  it('returns null with no match or an empty name', () => {
    expect(matchAlias('kaufland', aliases)).toBeNull();
    expect(matchAlias('', aliases)).toBeNull();
  });
});

describe('resolveCapture', () => {
  const base: CaptureContext = {
    language: 'ro',
    text: 'Plata cu cardul 45,20 RON la KAUFLAND BUC',
    postedAt: 1_700_000_000_000,
    accountId: 1,
    cashAccountId: 4,
    aliases: [alias(1, 7, 'kaufland')],
    merchants: [{ id: 7, defaultCategoryId: 100 }],
    categoryIdsByName: new Map([[normalizeText('Rate'), 200]]),
    rules: DEFAULT_KEYWORD_RULES,
  };
  const expense = { type: 'expense', amountMinor: 4520, currency: 'RON', merchantRaw: 'KAUFLAND BUC' } as const;

  it('confirms a payment to a known merchant with a default category', () => {
    const result = resolveCapture(expense, base);
    expect(result).toMatchObject({ status: 'confirmed', merchantId: 7, categoryId: 100 });
  });

  it('keeps an unknown merchant as a draft', () => {
    const result = resolveCapture(
      { ...expense, merchantRaw: 'GRAFRELY SRL' },
      { ...base, text: 'Plata la GRAFRELY SRL 45,20 RON' },
    );
    expect(result).toMatchObject({ status: 'draft', merchantId: null, categoryId: null });
  });

  it('takes the category from a keyword rule when there is no merchant', () => {
    const result = resolveCapture(
      { type: 'expense', amountMinor: 123456, currency: 'RON', merchantRaw: null },
      { ...base, text: 'Rata credit 1.234,56 RON' },
    );
    expect(result).toMatchObject({ status: 'confirmed', categoryId: 200 });
  });

  it('turns an ATM withdrawal into a confirmed transfer to cash', () => {
    const result = resolveCapture(
      {
        type: 'transfer',
        amountMinor: 50000,
        currency: 'RON',
        merchantRaw: null,
        transferToCash: true,
      },
      { ...base, text: 'Retragere numerar ATM 500,00 RON' },
    );
    expect(result).toMatchObject({ type: 'transfer', transferAccountId: 4, status: 'confirmed' });
  });

  it('leaves a transfer as a draft when there is no cash account', () => {
    const result = resolveCapture(
      { type: 'transfer', amountMinor: 50000, currency: 'RON', merchantRaw: null },
      { ...base, cashAccountId: null },
    );
    expect(result.status).toBe('draft');
  });

  it('does not assume an internal transfer goes to cash', () => {
    const result = resolveCapture(
      { type: 'transfer', amountMinor: 50000, currency: 'RON', merchantRaw: null },
      base,
    );
    expect(result).toMatchObject({
      type: 'transfer',
      transferAccountId: null,
      status: 'draft',
    });
  });
});

describe('dedupeHash', () => {
  const parts = { accountId: 1, type: 'expense', amountMinor: 100, merchantRaw: 'Kaufland SRL' } as const;

  it('is stable within a minute and ignores merchant formatting', () => {
    const a = dedupeHash({ ...parts, postedAt: 60_000 * 10 + 5_000 });
    const b = dedupeHash({ ...parts, postedAt: 60_000 * 10 + 50_000, merchantRaw: 'KAUFLAND' });
    expect(a).toBe(b);
  });

  it('differs across minutes', () => {
    expect(dedupeHash({ ...parts, postedAt: 0 })).not.toBe(dedupeHash({ ...parts, postedAt: 120_000 }));
  });
});
