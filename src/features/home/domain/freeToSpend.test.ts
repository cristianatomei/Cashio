import { daysUntilPayday, freeToSpend, homeObligations, parsePayday } from './freeToSpend';

const day = (value: string) => parsePayday(value)!;
const now = day('2026-03-25');
const payday = day('2026-04-01');
const obligation = {
  key: 'bill',
  name: 'Bill',
  dueAt: day('2026-03-27'),
  amountMinor: 2100,
  currency: 'RON',
  source: 'recurring' as const,
};
const input = {
  now,
  payday,
  baseCurrency: 'RON',
  balances: [{ amountMinor: 10000, currency: 'RON' }],
  obligations: [obligation],
  rates: [],
};
const rule = {
  id: 1,
  name: 'Bill',
  type: 'expense' as const,
  amountMinor: 2100,
  currency: 'RON',
  frequency: 'monthly' as const,
  interval: 1,
  nextDue: obligation.dueAt,
  endAt: null,
  active: true,
};
const installment = {
  dueAt: obligation.dueAt,
  paymentMinor: 2000,
  interestMinor: 500,
  principalMinor: 1500,
  balanceMinor: 10000,
  insuranceMinor: 100,
};
const loan = {
  id: 1,
  name: 'Loan',
  currency: 'RON',
  recurringId: 1,
  includeInsurance: true,
  installments: [installment],
};
const payment = {
  id: 1,
  type: 'expense',
  status: 'confirmed',
  amountMinor: 2100,
  currency: 'RON',
  occurredAt: installment.dueAt,
  merchantRaw: null,
  note: 'Loan',
  recurringId: 1,
};

describe('freeToSpend', () => {
  it('subtracts obligations once and floors daily minor units', () => {
    expect(freeToSpend(input)).toMatchObject({
      balanceMinor: 10000,
      reservedMinor: 2100,
      availableMinor: 7900,
      days: 7,
      dailyMinor: 1128,
      complete: true,
    });
  });

  it('keeps negative availability visible but never offers negative daily spending', () => {
    expect(
      freeToSpend({ ...input, balances: [{ amountMinor: -100, currency: 'RON' }] }),
    ).toMatchObject({ availableMinor: -2200, dailyMinor: 0 });
  });

  it.each([null, now, now - 86400000, NaN, day('2028-01-01')])(
    'requires an explicit future payday (%s)',
    (date) => {
      expect(freeToSpend({ ...input, payday: date }).dailyMinor).toBeNull();
    },
  );

  it('counts calendar days rather than 24h intervals across DST or time of day', () => {
    expect(daysUntilPayday(new Date(2026, 2, 28, 23, 59).getTime(), day('2026-03-30'))).toBe(2);
  });

  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '', '2026-1-02', 'salary'])(
    'rejects invalid dates (%s)',
    (date) => {
      expect(parsePayday(date)).toBeNull();
    },
  );

  it('accepts leap dates', () => expect(parsePayday('2028-02-29')).not.toBeNull());

  it('uses the latest non-future FX rate and rounds each converted amount', () => {
    expect(
      freeToSpend({
        ...input,
        balances: [
          { amountMinor: 101, currency: 'EUR' },
          { amountMinor: 100, currency: 'RON' },
        ],
        obligations: [{ ...obligation, amountMinor: 11, currency: 'EUR' }],
        rates: [
          { currency: 'EUR', rateToBase: 4, effectiveAt: now - 100 },
          { currency: 'EUR', rateToBase: 10, effectiveAt: payday },
          { currency: 'EUR', rateToBase: 4.99, effectiveAt: now },
        ],
      }),
    ).toMatchObject({ balanceMinor: 604, reservedMinor: 55, availableMinor: 549, dailyMinor: 78 });
  });

  it('blocks daily spending for missing balance FX instead of treating it as zero', () => {
    expect(
      freeToSpend({ ...input, balances: [{ amountMinor: -100, currency: 'EUR' }] }),
    ).toMatchObject({ complete: false, dailyMinor: null, availableMinor: null });
  });

  it('blocks daily spending for missing obligation FX', () => {
    expect(
      freeToSpend({ ...input, obligations: [{ ...obligation, currency: 'EUR' }] }),
    ).toMatchObject({ complete: false, dailyMinor: null });
  });

  it.each([0, -1, NaN, Infinity])('blocks invalid rates (%s)', (rateToBase) => {
    expect(
      freeToSpend({
        ...input,
        balances: [{ amountMinor: 100, currency: 'EUR' }],
        rates: [{ currency: 'EUR', rateToBase, effectiveAt: now }],
      }).complete,
    ).toBe(false);
  });

  it('does not present a daily amount without accounts', () => {
    expect(freeToSpend({ ...input, balances: [] }).dailyMinor).toBeNull();
  });

  it('blocks unsafe sums', () => {
    expect(
      freeToSpend({
        ...input,
        balances: [
          { amountMinor: Number.MAX_SAFE_INTEGER, currency: 'RON' },
          { amountMinor: 1, currency: 'RON' },
        ],
      }).dailyMinor,
    ).toBeNull();
  });

  it('includes today but excludes payday and prior dates', () => {
    expect(
      freeToSpend({
        ...input,
        obligations: [
          { ...obligation, dueAt: now },
          { ...obligation, dueAt: payday },
          { ...obligation, dueAt: now - 86400000 },
        ],
      }).reservedMinor,
    ).toBe(2100);
  });
});

describe('homeObligations', () => {
  const projection = { now, to: payday, rules: [rule], loans: [], payments: [] };

  it('ignores income, inactive and ended rules', () => {
    expect(
      homeObligations({
        ...projection,
        rules: [
          { ...rule, type: 'income' },
          { ...rule, id: 2, active: false },
          { ...rule, id: 3, endAt: now },
        ],
      }),
    ).toEqual([]);
  });

  it('projects all occurrences, not only the first three shown on Home', () => {
    const obligations = homeObligations({
      ...projection,
      rules: [{ ...rule, frequency: 'daily', nextDue: now }],
    });
    expect(obligations).toHaveLength(7);
    expect(freeToSpend({ ...input, obligations }).reservedMinor).toBe(14700);
  });

  it('uses loan totals including optional insurance instead of its linked recurring rule', () => {
    expect(homeObligations({ ...projection, loans: [loan] })).toEqual([
      expect.objectContaining({ source: 'loan', amountMinor: 2100 }),
    ]);
    expect(
      homeObligations({ ...projection, loans: [{ ...loan, includeInsurance: false }] })[0]
        .amountMinor,
    ).toBe(2000);
  });

  it('keeps distinct unlinked recurring expenses even when the amount matches a loan', () => {
    expect(
      homeObligations({ ...projection, loans: [{ ...loan, recurringId: null }] }),
    ).toHaveLength(2);
  });

  it('deducts posted recurring payments already reflected in balances', () => {
    expect(homeObligations({ ...projection, payments: [payment] })).toEqual([]);
  });

  it('deducts a linked partial loan payment only once', () => {
    const outstanding = homeObligations({
      ...projection,
      loans: [loan],
      payments: [{ ...payment, amountMinor: 1000 }],
    });
    expect(outstanding).toHaveLength(1);
    expect(outstanding[0].amountMinor).toBe(1100);
  });

  it('keeps unlinked loan payment suggestions reserved conservatively', () => {
    expect(
      homeObligations({
        ...projection,
        rules: [],
        loans: [{ ...loan, recurringId: null }],
        payments: [{ ...payment, recurringId: null }],
      }),
    ).toEqual([expect.objectContaining({ source: 'loan', amountMinor: 2100 })]);
  });

  it('deducts an explicitly confirmed early partial payment without relying on text or recurrence', () => {
    const outstanding = homeObligations({
      ...projection,
      rules: [],
      loans: [{ ...loan, recurringId: null }],
      payments: [{ ...payment, recurringId: null, occurredAt: now, amountMinor: 1000 }],
      loanPaymentLinks: [
        { scheduleId: loan.id, dueAt: installment.dueAt, transactionId: payment.id },
      ],
    });
    expect(outstanding).toEqual([expect.objectContaining({ source: 'loan', amountMinor: 1100 })]);
  });

  it('does not apply an explicitly associated transaction to another installment by recurrence', () => {
    const laterDue = installment.dueAt + 86400000;
    expect(
      homeObligations({
        ...projection,
        now: installment.dueAt,
        loans: [{ ...loan, installments: [installment, { ...installment, dueAt: laterDue }] }],
        payments: [payment],
        loanPaymentLinks: [{ scheduleId: loan.id, dueAt: laterDue, transactionId: payment.id }],
      }),
    ).toEqual([
      expect.objectContaining({ source: 'loan', dueAt: installment.dueAt, amountMinor: 2100 }),
    ]);
  });

  it('does not settle two linked loans from one ambiguous payment', () => {
    expect(
      homeObligations({
        ...projection,
        loans: [loan, { ...loan, id: 2 }],
        payments: [payment],
      }),
    ).toEqual([
      expect.objectContaining({ source: 'loan', amountMinor: 2100 }),
      expect.objectContaining({ source: 'loan', amountMinor: 2100 }),
    ]);
  });

  it('does not consider drafts, income or other currencies as settled payments', () => {
    for (const change of [{ status: 'draft' }, { type: 'income' }, { currency: 'EUR' }]) {
      expect(
        homeObligations({ ...projection, payments: [{ ...payment, ...change }] })[0].amountMinor,
      ).toBe(2100);
    }
  });

  it('includes due payments today even after midnight and excludes payday', () => {
    const result = homeObligations({
      ...projection,
      now: now + 12 * 3600000,
      rules: [
        { ...rule, nextDue: now },
        { ...rule, id: 2, nextDue: payday },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].dueAt).toBe(now);
  });
});
