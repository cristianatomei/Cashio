import { reconcileLoanPayments } from './reconciliation';

describe('reconcileLoanPayments', () => {
  const dueAt = new Date(2026, 9, 10).getTime();
  const schedules = [
    {
      id: 1,
      currency: 'RON',
      includeInsurance: true,
      installments: [
        {
          dueAt,
          paymentMinor: 100000,
          interestMinor: 20000,
          principalMinor: 80000,
          balanceMinor: 500000,
          insuranceMinor: 1000,
        },
      ],
    },
  ];

  it('matches an identified payment within five days and reports the expected total', () => {
    const matches = reconcileLoanPayments(schedules, [
      {
        id: 2,
        type: 'expense',
        status: 'confirmed',
        amountMinor: 101000,
        currency: 'RON',
        occurredAt: new Date(2026, 9, 12).getTime(),
        merchantRaw: 'Rata credit ING',
        note: null,
      },
    ]);

    expect(matches).toEqual([
      {
        scheduleId: 1,
        dueAt,
        transactionId: 2,
        expectedMinor: 101000,
        actualMinor: 101000,
      },
    ]);
  });

  it('does not match non-loan expenses or a payment outside the date window', () => {
    const payment = {
      id: 2,
      type: 'expense',
      status: 'confirmed',
      amountMinor: 101000,
      currency: 'RON',
      occurredAt: new Date(2026, 9, 10).getTime(),
      merchantRaw: 'Supermarket',
      note: null,
    };
    expect(reconcileLoanPayments(schedules, [payment])).toEqual([]);
    expect(
      reconcileLoanPayments(schedules, [
        { ...payment, merchantRaw: 'Rata credit ING', occurredAt: new Date(2026, 9, 16).getTime() },
      ]),
    ).toEqual([]);
  });

  it('leaves a payment unmatched when several installments could match', () => {
    const overlappingSchedules = [
      schedules[0],
      {
        ...schedules[0],
        id: 2,
      },
    ];
    const matches = reconcileLoanPayments(overlappingSchedules, [
      {
        id: 2,
        type: 'expense',
        status: 'confirmed',
        amountMinor: 90000,
        currency: 'RON',
        occurredAt: dueAt,
        merchantRaw: 'Rata credit ING',
        note: null,
      },
    ]);

    expect(matches).toEqual([]);
  });

  it('leaves an installment unmatched when several payments could match', () => {
    const payment = {
      id: 2,
      type: 'expense',
      status: 'confirmed',
      amountMinor: 101000,
      currency: 'RON',
      occurredAt: dueAt,
      merchantRaw: 'Rata credit ING',
      note: null,
    };
    expect(reconcileLoanPayments(schedules, [payment, { ...payment, id: 3 }])).toEqual([]);
    expect(reconcileLoanPayments(schedules, [{ ...payment, status: 'draft' }])).toEqual([]);
  });

  it('compares calendar days across daylight saving time', () => {
    const before = new Date(2026, 9, 23).getTime();
    const after = new Date(2026, 9, 28).getTime();
    const schedule = {
      ...schedules[0],
      installments: [{ ...schedules[0].installments[0], dueAt: before }],
    };
    expect(
      reconcileLoanPayments([schedule], [{
        id: 2,
        type: 'expense',
        status: 'confirmed',
        amountMinor: 101000,
        currency: 'RON',
        occurredAt: after,
        merchantRaw: 'Rata credit ING',
        note: null,
      }]),
    ).toHaveLength(1);
  });
});
