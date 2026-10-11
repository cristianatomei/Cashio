import { addMonths, combineDateAndTime, monthRange, startOfDay, startOfMonth } from './dates';

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

describe('dates', () => {
  it('finds the start of a day and a month', () => {
    expect(startOfDay(at(2026, 10, 7, 15, 20))).toBe(at(2026, 10, 7));
    expect(startOfMonth(at(2026, 10, 7, 15, 20))).toBe(at(2026, 10, 1));
  });

  it('moves across year boundaries', () => {
    expect(addMonths(at(2026, 12, 15), 1)).toBe(at(2027, 1, 1));
    expect(addMonths(at(2026, 1, 31), -1)).toBe(at(2025, 12, 1));
  });

  it('builds a half-open month range', () => {
    expect(monthRange(at(2026, 2, 10))).toEqual({ from: at(2026, 2, 1), to: at(2026, 3, 1) });
  });

  it('combines a date with a time', () => {
    expect(combineDateAndTime(at(2026, 10, 7, 9, 0), at(2020, 1, 1, 18, 45))).toBe(
      at(2026, 10, 7, 18, 45),
    );
  });
});
