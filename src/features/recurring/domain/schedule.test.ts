import { recurringPaymentsInRange } from './schedule';

describe('recurringPaymentsInRange', () => {
  const from = new Date(2026, 11, 1).getTime();
  const to = new Date(2027, 0, 1).getTime();

  it('lists recurring occurrences for the selected month', () => {
    const payments = recurringPaymentsInRange(
      [
        {
          id: 1,
          name: 'Rent',
          amountMinor: 100000,
          currency: 'RON',
          frequency: 'monthly',
          interval: 1,
          nextDue: new Date(2026, 9, 5).getTime(),
          endAt: null,
          active: true,
        },
      ],
      from,
      to,
    );

    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      key: `recurring-1-${new Date(2026, 11, 5).getTime()}`,
      amountMinor: 100000,
      currency: 'RON',
    });
  });

  it('excludes inactive, ended, invalid, and out-of-range rules', () => {
    const monthly = {
      id: 2,
      name: 'Bill',
      amountMinor: 5000,
      currency: 'RON',
      frequency: 'monthly' as const,
      interval: 1,
      nextDue: new Date(2026, 10, 5).getTime(),
      endAt: null,
      active: true,
    };

    expect(
      recurringPaymentsInRange(
        [
          { ...monthly, id: 2, active: false },
          { ...monthly, id: 3, endAt: new Date(2026, 10, 31).getTime() },
          { ...monthly, id: 4, interval: 0 },
          { ...monthly, id: 5, nextDue: new Date(2027, 0, 5).getTime() },
        ],
        from,
        to,
      ),
    ).toEqual([]);
  });

  it('returns no entries for an empty date range', () => {
    expect(recurringPaymentsInRange([], to, from)).toEqual([]);
  });
});
