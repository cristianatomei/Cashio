import { minorToInput, parseAmountToMinor, parseSignedAmountToMinor } from './money';

describe('signed amounts', () => {
  it.each([
    ['', 0],
    ['-12,50', -1250],
    ['300', 30000],
  ])('parses %s', (input, expected) => {
    expect(parseSignedAmountToMinor(input)).toBe(expected);
  });

  it('rejects text', () => {
    expect(parseSignedAmountToMinor('abc')).toBeNull();
  });

  it('round-trips through the input format', () => {
    for (const minor of [0, 5, 1250, -1250, 123456]) {
      expect(parseSignedAmountToMinor(minorToInput(minor))).toBe(minor);
    }
  });
});

describe('parseAmountToMinor', () => {
  it.each([
    ['12,50', 1250],
    ['1.234,56', 123456],
    ['1234.56', 123456],
    ['100', 10000],
    ['0,5', 50],
  ])('parses %s', (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected);
  });

  it('rejects non-numeric input', () => {
    expect(parseAmountToMinor('abc')).toBeNull();
  });
});
