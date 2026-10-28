import { donutArc, drilldownParams, sparklinePoints } from './charts';

describe('chart geometry', () => {
  it('passes inclusive local dates and clears stale group/category/currency route filters', () => {
    const range = { from: new Date(2026, 9, 1).getTime(), to: new Date(2026, 10, 1).getTime() };
    expect(drilldownParams('categories', 'uncategorized', range, 'RON')).toEqual({
      categoryId: 'uncategorized',
      groupId: '',
      from: '2026-10-01',
      to: '2026-10-31',
      type: 'expense',
      currency: '',
    });
    expect(drilldownParams('groups', '2', range, 'EUR')).toMatchObject({
      groupId: '2',
      categoryId: '',
      currency: 'EUR',
    });
  });
  it('handles empty, single, constant and negative sparkline series without NaN', () => {
    expect(sparklinePoints([])).toBe('');
    expect(sparklinePoints([0])).toBe('56,16');
    expect(sparklinePoints([0, 0])).toBe('0,16 112,16');
    expect(sparklinePoints([-100, 0, 100])).toBe('0,32 56,16 112,0');
  });

  it('draws real arcs rather than overlapping dashed full-circle touch targets', () => {
    expect(donutArc(50, 50, 40, 0, Math.PI)).toBe('M 50 10 A 40 40 0 0 1 50 90');
    expect(donutArc(50, 50, 40, 0, 1.5 * Math.PI)).toContain(' 0 1 1 ');
  });
});
