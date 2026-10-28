import { filterDateRange, localDate, parseSavedFilter } from './savedFilters';
import { dailyCurrencyTotals, merchantIdentity } from './merchantIdentity';

describe('saved transaction filters', () => {
  it('roundtrips all filter fields including drilldown sentinels', () => {
    const filter = {
      query: 'Mega',
      type: 'expense',
      categoryId: 'uncategorized',
      groupId: 2,
      accountId: 1,
      tagId: 3,
      currency: 'RON',
      from: '2026-10-01',
      to: '2026-10-28',
    };
    expect(parseSavedFilter(JSON.stringify(filter))).toEqual(filter);
  });
  it('uses inclusive calendar end dates', () => {
    expect(
      filterDateRange({ query: '', type: 'all', from: '2026-10-01', to: '2026-10-28' }),
    ).toEqual({ from: localDate('2026-10-01'), to: localDate('2026-10-29') });
  });
  it.each([
    { type: 'oops' },
    { type: 'all', query: '', tagId: -1 },
    { type: 'all', query: '', from: '2026-10-01' },
    { type: 'all', query: '', from: '2026-02-30', to: '2026-03-01' },
    { type: 'all', query: '', from: '2026-10-28', to: '2026-10-01' },
  ])('rejects invalid filters %j', (filter) => {
    expect(() => parseSavedFilter(JSON.stringify(filter))).toThrow();
  });
  it('gives merchants deterministic Unicode initials and colors', () => {
    expect(merchantIdentity('Ștefan Market').initials).toBe('ȘM');
    expect(merchantIdentity('  Mega Image ').color).toBe(merchantIdentity('mega image').color);
    expect(merchantIdentity('').initials).toBe('?');
  });
  it('keeps daily totals per currency, excluding transfers and drafts', () => {
    expect(
      dailyCurrencyTotals([
        { currency: 'RON', type: 'expense', status: 'confirmed', amountMinor: 1200 },
        { currency: 'EUR', type: 'income', status: 'confirmed', amountMinor: 500 },
        { currency: 'RON', type: 'transfer', status: 'confirmed', amountMinor: 900 },
        { currency: 'RON', type: 'expense', status: 'draft', amountMinor: 200 },
      ]),
    ).toEqual([
      { currency: 'EUR', income: 500, expense: 0, balance: 500 },
      { currency: 'RON', income: 0, expense: 1200, balance: -1200 },
    ]);
  });
});
