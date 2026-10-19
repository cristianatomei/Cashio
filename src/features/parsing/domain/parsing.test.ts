import { extractAmount } from './amount';
import { normalizeMerchant, prettifyMerchant, suggestMerchantName } from './normalize';
import { parseNotification } from './parseNotification';

describe('extractAmount', () => {
  it.each([
    ['Plata 45,20 RON la X', 4520, 'RON'],
    ['Paid RON 45.20 at X', 4520, 'RON'],
    ['Incasare 3.500,00 lei', 350000, 'RON'],
    ['Paid €12.50 to Netflix', 1250, 'EUR'],
    ['Suma: 500,00 RON.', 50000, 'RON'],
  ])('reads %s', (text, amountMinor, currency) => {
    expect(extractAmount(text)).toEqual({ amountMinor, currency });
  });

  it('returns null when there is no amount', () => {
    expect(extractAmount('Contul tau a fost actualizat')).toBeNull();
  });
});

describe('normalizeMerchant', () => {
  it.each([
    ['KAUFLAND BUC', 'kaufland buc'],
    ['GRAFRELY S.R.L.', 'grafrely'],
    ['Grafrely SRL', 'grafrely'],
    ['MEGA IMAGE 12345 ROMANIA', 'mega image'],
    ['Țigări & Cafea', 'tigari cafea'],
  ])('normalizes %s', (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected);
  });
});

describe('prettifyMerchant', () => {
  it('title-cases shouting names and keeps mixed case', () => {
    expect(prettifyMerchant('KAUFLAND BUC')).toBe('Kaufland Buc');
    expect(prettifyMerchant('Netflix')).toBe('Netflix');
  });
});

describe('suggestMerchantName', () => {
  it.each([
    ['GRAFRELY S.R.L', 'Grafrely'],
    ['GRAFRELY SRL', 'Grafrely'],
    ['MEGA IMAGE SA', 'Mega Image'],
    ['KAUFLAND BUC', 'Kaufland Buc'],
    ['Netflix', 'Netflix'],
  ])('suggests %s', (raw, expected) => {
    expect(suggestMerchantName(raw)).toBe(expected);
  });
});

describe('parseNotification', () => {
  const parse = (title: string | null, body: string, sourceName = 'ING') =>
    parseNotification({ sourceName, title, body });

  it('parses a card payment', () => {
    expect(parse('ING', 'Plata cu cardul: 45,20 RON la KAUFLAND BUC')).toEqual({
      type: 'expense',
      amountMinor: 4520,
      currency: 'RON',
      merchantRaw: 'KAUFLAND BUC',
    });
  });

  it("parses the ING Home'Bank authorization format", () => {
    expect(
      parse(
        'Mesaj nou de la ING',
        'Ai autorizat tranzactia de 51.5 RON la GRAFRELY S R L din contul 9999003288660 in 07-10-2026. Sold: 20.4 RON.',
      ),
    ).toEqual({
      type: 'expense',
      amountMinor: 5150,
      currency: 'RON',
      merchantRaw: 'GRAFRELY S R L',
    });
  });

  it('stops the merchant before card details', () => {
    expect(
      parse('ING', 'Ai platit 12,50 RON la GRAFRELY S.R.L. cu cardul ****1234.')?.merchantRaw,
    ).toBe('GRAFRELY S.R.L');
  });

  it('parses incoming money', () => {
    expect(parse('ING', 'Incasare 3.500,00 RON de la ACME SRL')).toEqual({
      type: 'income',
      amountMinor: 350000,
      currency: 'RON',
      merchantRaw: 'ACME SRL',
    });
  });

  it('treats ATM withdrawals as transfers without a merchant', () => {
    expect(parse('ING', 'Retragere numerar ATM 500,00 RON')).toEqual({
      type: 'transfer',
      amountMinor: 50000,
      currency: 'RON',
      merchantRaw: null,
      transferToCash: true,
    });
  });

  it('detects the direction of an incoming transfer', () => {
    expect(parse('ING', 'Transfer primit de la RO49AAAA1B31007593840000: 500 RON')).toMatchObject({
      type: 'transfer',
      transferDirection: 'incoming',
    });
  });

  it('detects the direction of an outgoing transfer', () => {
    expect(parse('ING', 'Transfer trimis catre RO49AAAA1B31007593840000: 500 RON')).toMatchObject({
      type: 'transfer',
      transferDirection: 'outgoing',
    });
  });

  it('uses the title as merchant when the body has none (Revolut style)', () => {
    expect(parse('Kaufland', 'Card payment: RON 45.20', 'Revolut')).toEqual({
      type: 'expense',
      amountMinor: 4520,
      currency: 'RON',
      merchantRaw: 'Kaufland',
    });
  });

  it('keeps loan installments without a merchant', () => {
    const parsed = parse('ING', 'Rata credit 1.234,56 RON a fost debitata');
    expect(parsed?.type).toBe('expense');
    expect(parsed?.amountMinor).toBe(123456);
    expect(parsed?.merchantRaw).toBeNull();
  });

  it('parses foreign currency payments', () => {
    expect(parse(null, 'Paid €12.50 to Netflix', 'Revolut')).toEqual({
      type: 'expense',
      amountMinor: 1250,
      currency: 'EUR',
      merchantRaw: 'Netflix',
    });
  });

  it('ignores notifications without an amount', () => {
    expect(parse('ING', 'Ai o noua oferta pentru tine')).toBeNull();
  });

  it('ignores a declined authorization even when it contains an amount and merchant', () => {
    expect(
      parse(
        'Mesaj nou de la ING',
        "Nu ai fonduri suficiente pentru autorizarea tranzactiei in valoare de 29.00 USD efectuata la comerciantul GITHUB, INC.. Poti consulta soldul in Home'Bank.",
      ),
    ).toBeNull();
  });
});
