import { groupByDay, summarize } from './grouping';

const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime();

describe('groupByDay', () => {
  it('groups by day, newest first', () => {
    const rows = [
      { id: 1, occurredAt: at(5, 9) },
      { id: 2, occurredAt: at(6, 8) },
      { id: 3, occurredAt: at(6, 18) },
    ];
    const groups = groupByDay(rows);
    expect(groups.map((g) => g.items.map((r) => r.id))).toEqual([[3, 2], [1]]);
  });

  it('returns nothing for no rows', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('summarize', () => {
  it('ignores transfers and drafts', () => {
    const totals = summarize([
      { type: 'income', status: 'confirmed', amountMinor: 10000 },
      { type: 'expense', status: 'confirmed', amountMinor: 2500 },
      { type: 'expense', status: 'draft', amountMinor: 999 },
      { type: 'transfer', status: 'confirmed', amountMinor: 5000 },
    ]);
    expect(totals).toEqual({ income: 10000, expense: 2500, balance: 7500 });
  });
});
