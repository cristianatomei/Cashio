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

  it('uses a payment at most once across all installments', () => {
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
        amountMinor: 90000,
        currency: 'RON',
        occurredAt: dueAt,
        merchantRaw: 'Rata credit ING',
        note: null,
      },
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0].actualMinor).toBe(90000);
  });
});
