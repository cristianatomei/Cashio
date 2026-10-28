import {
  canNotifyCapture,
  captureRoute,
  frequentCategories,
  monthlyCashFlow,
  positiveId,
} from './productivity';

const now = new Date(2026, 9, 15).getTime();
const row = {
  type: 'expense',
  status: 'confirmed',
  currency: 'RON',
  amountMinor: 1200,
  occurredAt: now,
};

describe('monthly widget cash flow', () => {
  it('keeps currencies separate, subtracts expenses and adds income', () => {
    expect(
      monthlyCashFlow(
        [row, { ...row, type: 'income', amountMinor: 2000 }, { ...row, currency: 'EUR' }],
        now,
      ),
    ).toEqual([
      ['EUR', -1200],
      ['RON', 800],
    ]);
  });
  it('ignores drafts, transfers and transactions outside the local month', () => {
    expect(
      monthlyCashFlow(
        [
          { ...row, status: 'draft' },
          { ...row, type: 'transfer' },
          { ...row, occurredAt: new Date(2026, 8, 30, 23, 59).getTime() },
          { ...row, occurredAt: new Date(2026, 10, 1).getTime() },
        ],
        now,
      ),
    ).toEqual([]);
  });
  it('includes the local first instant and zero net without inventing account balances', () => {
    expect(
      monthlyCashFlow(
        [
          { ...row, occurredAt: new Date(2026, 9, 1).getTime() },
          { ...row, type: 'income' },
        ],
        now,
      ),
    ).toEqual([['RON', 0]]);
  });
});

describe('notification limits', () => {
  it.each([
    [5, 0, 0],
    [0, 50, 0],
    [0, 48, 2],
  ])('refuses full limits %s/%s/%s', (daily, scheduled, presented) => {
    expect(canNotifyCapture(daily, scheduled, presented)).toBe(false);
  });
  it('uses only spare slots and never cancels reminders', () => {
    expect(canNotifyCapture(4, 48, 1)).toBe(true);
  });
});

describe('frequent action categories', () => {
  it('counts expenses only, ignores removed categories and breaks ties predictably', () => {
    expect(
      frequentCategories(
        [
          { type: 'expense', categoryId: 2 },
          { type: 'expense', categoryId: 2 },
          { type: 'expense', categoryId: 1 },
          { type: 'expense', categoryId: 3 },
          { type: 'income', categoryId: 3 },
          { type: 'expense', categoryId: 99 },
          { type: 'expense', categoryId: null },
        ],
        [
          { id: 3, name: 'C' },
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ],
      ),
    ).toEqual([
      { id: 2, name: 'B' },
      { id: 1, name: 'A' },
    ]);
  });
});

describe('capture action routes', () => {
  it('opens the actual captured transaction editor', () => {
    expect(captureRoute(42)).toEqual({ pathname: '/add-transaction', params: { id: '42' } });
  });
  it.each([
    undefined,
    null,
    '',
    '0',
    0,
    -1,
    '1.2',
    'Infinity',
    '1e2',
    '12abc',
    [],
    {},
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects malformed or unsafe transaction ids %s', (id) => {
    expect(captureRoute(id)).toBeNull();
    expect(positiveId(id)).toBeNull();
  });
});
