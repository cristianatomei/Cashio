import { goalProgress, validateGoal, validateValuation } from './goals';
import { dateInput, valuationDate } from './valuationDate';

const goal = { name: 'Synthetic goal', currency: 'RON', targetMinor: 10000, currentMinor: 2500 };

describe('savings goals', () => {
  it('calculates empty, partial, completed and overfunded goals without extra money', () => {
    expect(goalProgress({ ...goal, currentMinor: 0 })).toEqual({
      ratio: 0,
      percent: 0,
      remainingMinor: 10000,
      complete: false,
    });
    expect(goalProgress(goal)).toEqual({
      ratio: 0.25,
      percent: 25,
      remainingMinor: 7500,
      complete: false,
    });
    for (const currentMinor of [10000, 12000]) {
      expect(goalProgress({ ...goal, currentMinor })).toEqual({
        ratio: 1,
        percent: 100,
        remainingMinor: 0,
        complete: true,
      });
    }
  });

  it.each([
    { name: ' ' },
    { currency: 'ron' },
    { currency: 'R' },
    { targetMinor: 0 },
    { targetMinor: -1 },
    { currentMinor: -1 },
    { currentMinor: 0.1 },
    { targetMinor: Infinity },
    { currentMinor: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid goals %j', (values) => {
    expect(() => validateGoal({ ...goal, ...values })).toThrow('Invalid savings goal');
  });
});

describe('manual investment valuations', () => {
  const value = { assetId: 'synthetic', currency: 'EUR', amountMinor: 0, valuedAt: 1 };
  it('accepts an explicitly recorded zero holding', () => {
    expect(() => validateValuation(value)).not.toThrow();
  });
  it.each([
    { assetId: '' },
    { amountMinor: -1 },
    { amountMinor: 1.5 },
    { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
    { currency: 'bad' },
    { valuedAt: -1 },
    { valuedAt: 8640000000000001 },
  ])('rejects invalid valuations %j', (values) => {
    expect(() => validateValuation({ ...value, ...values })).toThrow(
      'Invalid investment valuation',
    );
  });
  it('validates real local dates and rejects future dates', () => {
    const now = new Date(2026, 9, 28, 12).getTime();
    expect(dateInput(now)).toBe('2026-10-28');
    expect(valuationDate('2026-10-28', now)).toBe(now);
    expect(valuationDate('2026-10-27', now)).toBe(new Date(2026, 9, 27, 23, 59, 59, 999).getTime());
    expect(valuationDate('2026-02-29', now)).toBeNull();
    expect(valuationDate('2026-10-29', now)).toBeNull();
    expect(valuationDate('2026-2-01', now)).toBeNull();
    expect(valuationDate('', now)).toBeNull();
  });
});
