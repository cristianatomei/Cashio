import { isValidIban, normalizeIban } from './iban';

describe('IBAN utilities', () => {
  it('normalizes spaces, hyphens, and casing', () => {
    expect(normalizeIban('ro49 aaaa-1b31 0075 9384 0000')).toBe('RO49AAAA1B31007593840000');
  });

  it('validates an IBAN checksum', () => {
    expect(isValidIban('RO49AAAA1B31007593840000')).toBe(true);
    expect(isValidIban('RO49 AAAA 1B31 0075 9384 0001')).toBe(false);
    expect(isValidIban('not an iban')).toBe(false);
  });
});
