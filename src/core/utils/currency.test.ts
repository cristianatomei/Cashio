import { convertToBaseMinor } from './currency';

describe('convertToBaseMinor', () => {
  it('converts integer minor units and rounds to the nearest minor unit', () => {
    expect(convertToBaseMinor(1000, 4.97)).toBe(4970);
    expect(convertToBaseMinor(101, 0.5)).toBe(51);
  });

  it('rejects invalid rates and unsafe values', () => {
    expect(convertToBaseMinor(100, 0)).toBeNull();
    expect(convertToBaseMinor(100, Number.NaN)).toBeNull();
    expect(convertToBaseMinor(1.5, 2)).toBeNull();
    expect(convertToBaseMinor(Number.MAX_SAFE_INTEGER, 2)).toBeNull();
  });
});
