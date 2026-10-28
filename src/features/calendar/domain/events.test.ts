import {
  eventDates,
  eventMarker,
  exportRange,
  managedKey,
  projectPayments,
  selectSync,
  type CalendarPayment,
  type ExportLoan,
  type ExportRule,
} from './events';

const date = (month: number, day: number, year = 2026) => new Date(year, month - 1, day).getTime();
const range = { from: date(1, 1), to: date(4, 1) };
const rule: ExportRule = {
  id: 1,
  name: 'Never exported',
  type: 'expense',
  amountMinor: 12345,
  amountVariable: false,
  currency: 'RON',
  frequency: 'monthly',
  interval: 1,
  nextDue: date(1, 10),
  endAt: null,
  active: true,
};
const loan: ExportLoan = {
  id: 2,
  recurringId: null,
  currency: 'EUR',
  includeInsurance: false,
  installments: [
    {
      dueAt: date(1, 12),
      paymentMinor: 12001,
      principalMinor: 10000,
      interestMinor: 2001,
      balanceMinor: 20000,
      insuranceMinor: 600,
    },
    {
      dueAt: date(2, 15),
      paymentMinor: 11903,
      principalMinor: 10000,
      interestMinor: 1903,
      balanceMinor: 10000,
      insuranceMinor: 500,
    },
    {
      dueAt: date(4, 1),
      paymentMinor: 11000,
      principalMinor: 10000,
      interestMinor: 1000,
      balanceMinor: 0,
      insuranceMinor: 400,
    },
  ],
};

describe('calendar payment projection', () => {
  it('uses a half-open twelve-month range, including today and clamping leap day', () => {
    expect(exportRange(new Date(2026, 9, 28, 16, 20).getTime())).toEqual({
      from: date(10, 28),
      to: date(10, 28, 2027),
    });
    expect(exportRange(date(2, 29, 2028))).toEqual({
      from: date(2, 29, 2028),
      to: date(2, 28, 2029),
    });
  });

  it('exports active expenses only, respecting frequency, end dates and boundaries', () => {
    const result = projectPayments(
      [
        rule,
        { ...rule, id: 2, active: false },
        { ...rule, id: 3, type: 'income' },
        { ...rule, id: 4, nextDue: range.from, endAt: range.from, amountVariable: true },
        { ...rule, id: 5, nextDue: range.to },
        { ...rule, id: 6, frequency: 'weekly', interval: 2, nextDue: date(3, 10) },
      ],
      [],
      range,
    );
    expect(result.map((row) => row.key)).toEqual([
      `recurring-4-${range.from}`,
      `recurring-1-${date(1, 10)}`,
      `recurring-1-${date(2, 10)}`,
      `recurring-1-${date(3, 10)}`,
      `recurring-6-${date(3, 10)}`,
      `recurring-6-${date(3, 24)}`,
    ]);
    expect(result[0].estimated).toBe(true);
    expect(result[1].estimated).toBe(false);
  });

  it('keeps individual loan amounts/dates, including optional variable insurance', () => {
    const result = projectPayments([], [loan], range);
    expect(
      result.map(({ dueAt, amountMinor, currency, estimated }) => ({
        dueAt,
        amountMinor,
        currency,
        estimated,
      })),
    ).toEqual([
      { dueAt: date(1, 12), amountMinor: 12001, currency: 'EUR', estimated: false },
      { dueAt: date(2, 15), amountMinor: 11903, currency: 'EUR', estimated: false },
    ]);
    expect(
      projectPayments([], [{ ...loan, includeInsurance: true }], range).map(
        (row) => row.amountMinor,
      ),
    ).toEqual([12601, 12403]);
  });

  it('does not also export a legacy fixed recurring rule linked to a dated loan', () => {
    const result = projectPayments([rule], [{ ...loan, recurringId: rule.id }], range);
    expect(result).toHaveLength(2);
    expect(result.every((row) => row.kind === 'loan')).toBe(true);
  });

  it('returns nothing for empty data or an empty range', () => {
    expect(projectPayments([], [], range)).toEqual([]);
    expect(projectPayments([rule], [loan], { from: range.to, to: range.to })).toEqual([]);
  });

  it('uses date-only UTC Android dates and local iOS dates across DST', () => {
    const due = new Date(2026, 2, 29, 12).getTime();
    expect(eventDates(due)).toEqual({
      startDate: new Date('2026-03-29T00:00:00.000Z'),
      endDate: new Date('2026-03-30T00:00:00.000Z'),
    });
    const ios = eventDates(due, false);
    expect(ios.startDate.getDate()).toBe(29);
    expect(ios.endDate.getDate()).toBe(30);
    expect(ios.startDate.getHours()).toBe(0);
    expect(ios.endDate.getHours()).toBe(0);
  });
});

describe('owned calendar event sync selection', () => {
  const payment: CalendarPayment = {
    key: 'loan-1-123',
    kind: 'loan',
    dueAt: 123,
    amountMinor: 10000,
    currency: 'RON',
    estimated: false,
  };
  const existing = (id: string, key = payment.key, owner = 'owner', calendarId = 'chosen') => ({
    id,
    calendarId,
    notes: eventMarker(owner, key),
  });

  it('creates initially and then updates the same event rather than duplicating it', () => {
    expect(selectSync([payment], [], 'chosen', 'owner')).toEqual({
      create: [payment],
      update: [],
      remove: [],
    });
    const changed = { ...payment, amountMinor: 9901 };
    expect(selectSync([changed], [existing('native-id')], 'chosen', 'owner')).toEqual({
      create: [],
      update: [{ id: 'native-id', payment: changed }],
      remove: [],
    });
  });

  it('removes stale, out-of-range and duplicate owned events', () => {
    expect(
      selectSync(
        [payment],
        [existing('first'), existing('duplicate'), existing('stale', 'recurring-2-456')],
        'chosen',
        'owner',
      ),
    ).toEqual({
      create: [],
      update: [{ id: 'first', payment }],
      remove: ['duplicate', 'stale'],
    });
  });

  it('never adopts, updates or deletes unrelated events, other calendars or other owners', () => {
    const foreign = [
      existing('other-owner', payment.key, 'another'),
      existing('other-calendar', payment.key, 'owner', 'other'),
      { id: 'personal', calendarId: 'chosen', notes: 'Cashio payment' },
      { id: 'empty', calendarId: 'chosen', notes: null },
      existing('malformed', 'loan-1-123\nprivate note'),
    ];
    expect(foreign.map((event) => managedKey(event, 'chosen', 'owner'))).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(selectSync([], foreign, 'chosen', 'owner')).toEqual({
      create: [],
      update: [],
      remove: [],
    });
  });

  it('cleans up only owned events when disabled', () => {
    expect(
      selectSync(
        [],
        [existing('own'), existing('foreign', payment.key, 'other')],
        'chosen',
        'owner',
      ),
    ).toEqual({ create: [], update: [], remove: ['own'] });
  });
});
