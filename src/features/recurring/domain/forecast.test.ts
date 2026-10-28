import {
  estimateNextMonth,
  findRecurringMatch,
  nextDueAfterPayment,
  occurrencesInRange,
} from './forecast';

const timestamp = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day).getTime();

describe('occurrencesInRange', () => {
  it('projects a monthly obligation into the target month', () => {
    expect(
      occurrencesInRange(
        {
          amountMinor: 20000,
          currency: 'RON',
          frequency: 'monthly',
          interval: 1,
          nextDue: timestamp(2026, 10, 15),
          endAt: null,
          active: true,
        },
        timestamp(2026, 11, 1),
        timestamp(2026, 12, 1),
      ),
    ).toBe(1);
  });

  it('does not project a yearly obligation in months without a due date', () => {
    expect(
      occurrencesInRange(
        {
          amountMinor: 70000,
          currency: 'RON',
          frequency: 'yearly',
          interval: 1,
          nextDue: timestamp(2026, 10, 7),
          endAt: null,
          active: true,
        },
        timestamp(2026, 11, 1),
        timestamp(2026, 12, 1),
      ),
    ).toBe(0);
  });
});

describe('estimateNextMonth', () => {
  it('adds upcoming obligations to the three-month variable-spend average', () => {
    expect(
      estimateNextMonth({
        rules: [
          {
            amountMinor: 20000,
            currency: 'RON',
            frequency: 'monthly',
            interval: 1,
            nextDue: timestamp(2026, 10, 15),
            endAt: null,
            active: true,
          },
        ],
        loanPayments: [
          { amountMinor: 123450, currency: 'RON', dueAt: timestamp(2026, 11, 10) },
          { amountMinor: 124650, currency: 'RON', dueAt: timestamp(2026, 11, 10) },
          { amountMinor: 99900, currency: 'EUR', dueAt: timestamp(2026, 12, 1) },
        ],
        transactions: [
          {
            amountMinor: 10000,
            currency: 'RON',
            occurredAt: timestamp(2026, 8, 3),
            source: 'manual',
            status: 'confirmed',
            type: 'expense',
          },
          {
            amountMinor: 20000,
            currency: 'RON',
            occurredAt: timestamp(2026, 9, 3),
            source: 'notification',
            status: 'confirmed',
            type: 'expense',
          },
          {
            amountMinor: 30000,
            currency: 'RON',
            occurredAt: timestamp(2026, 10, 3),
            source: 'manual',
            status: 'confirmed',
            type: 'expense',
          },
          {
            amountMinor: 90000,
            currency: 'RON',
            occurredAt: timestamp(2026, 9, 3),
            source: 'recurring',
            status: 'confirmed',
            type: 'expense',
          },
        ],
        targetFrom: timestamp(2026, 11, 1),
        targetTo: timestamp(2026, 12, 1),
        historyFrom: timestamp(2026, 8, 1),
        historyTo: timestamp(2026, 11, 1),
      }),
    ).toEqual([
      {
        currency: 'RON',
        obligationsMinor: 268100,
        variableAverageMinor: 20000,
        totalMinor: 288100,
      },
    ]);
  });

  it('uses individual loan amounts, deduplicates a loan recurrence, and excludes paid history', () => {
    expect(
      estimateNextMonth({
        rules: [
          {
            name: 'Rata credit ING',
            amountMinor: 100000,
            currency: 'RON',
            frequency: 'monthly',
            interval: 1,
            nextDue: timestamp(2026, 10, 10),
            endAt: null,
            active: true,
          },
        ],
        loanPayments: [
          {
            scheduleId: 1,
            amountMinor: 102500,
            currency: 'RON',
            dueAt: timestamp(2026, 11, 12),
          },
          {
            scheduleId: 1,
            amountMinor: 87500,
            currency: 'RON',
            dueAt: timestamp(2026, 11, 25),
          },
        ],
        transactions: [
          {
            amountMinor: 101000,
            currency: 'RON',
            occurredAt: timestamp(2026, 10, 10),
            source: 'manual',
            status: 'confirmed',
            type: 'expense',
            loanPayment: true,
          },
          {
            amountMinor: 30000,
            currency: 'RON',
            occurredAt: timestamp(2026, 10, 11),
            source: 'manual',
            status: 'confirmed',
            type: 'expense',
          },
        ],
        targetFrom: timestamp(2026, 11, 1),
        targetTo: timestamp(2026, 12, 1),
        historyFrom: timestamp(2026, 8, 1),
        historyTo: timestamp(2026, 11, 1),
      }),
    ).toEqual([
      {
        currency: 'RON',
        obligationsMinor: 190000,
        variableAverageMinor: 10000,
        totalMinor: 200000,
      },
    ]);
  });

  it('does not project loan installments outside the target period', () => {
    expect(
      estimateNextMonth({
        rules: [],
        loanPayments: [
          { amountMinor: 120000, currency: 'RON', dueAt: timestamp(2026, 10, 10) },
          { amountMinor: 130000, currency: 'RON', dueAt: timestamp(2026, 12, 10) },
        ],
        transactions: [],
        targetFrom: timestamp(2026, 11, 1),
        targetTo: timestamp(2026, 12, 1),
        historyFrom: timestamp(2026, 8, 1),
        historyTo: timestamp(2026, 11, 1),
      }),
    ).toEqual([]);
  });
});

describe('recurring transaction matching', () => {
  const rule = {
    id: 4,
    accountId: 2,
    type: 'expense' as const,
    amountMinor: 50000,
    amountVariable: false,
    currency: 'RON',
    categoryId: 7,
    merchantId: 9,
    frequency: 'yearly' as const,
    interval: 1,
    nextDue: timestamp(2026, 10, 7),
    endAt: null,
    active: true,
  };
  const payment = {
    accountId: 2,
    type: 'expense',
    amountMinor: 50000,
    currency: 'RON',
    categoryId: 7,
    merchantId: 9,
    occurredAt: timestamp(2026, 10, 8),
  };

  it('matches a payment by merchant and category near its due date', () => {
    expect(findRecurringMatch(payment, [rule])?.id).toBe(4);
  });

  it('does not match when amount or due date differs', () => {
    expect(findRecurringMatch({ ...payment, amountMinor: 50001 }, [rule])).toBeNull();
    expect(
      findRecurringMatch({ ...payment, occurredAt: timestamp(2026, 11, 1) }, [rule]),
    ).toBeNull();
    expect(findRecurringMatch({ ...payment, merchantId: 10 }, [rule])).toBeNull();
  });

  it('allows variable amounts but still requires the account, identity, currency and due window', () => {
    const variableRule = { ...rule, amountVariable: true };
    expect(findRecurringMatch({ ...payment, amountMinor: 12345 }, [variableRule])?.id).toBe(4);
    expect(
      findRecurringMatch({ ...payment, amountMinor: 12345, accountId: 5 }, [variableRule]),
    ).toBeNull();
    expect(
      findRecurringMatch({ ...payment, amountMinor: 12345, currency: 'EUR' }, [variableRule]),
    ).toBeNull();
    expect(
      findRecurringMatch({ ...payment, amountMinor: 12345, occurredAt: timestamp(2026, 11, 1) }, [
        variableRule,
      ]),
    ).toBeNull();
  });

  it('advances a matched annual obligation beyond the payment date', () => {
    expect(nextDueAfterPayment(rule, payment.occurredAt)).toBe(timestamp(2027, 10, 7));
  });
});
