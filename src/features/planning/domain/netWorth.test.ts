import { calculateNetWorth, scheduledPrincipal } from './netWorth';

const day = (day: number) => new Date(2026, 9, day).getTime();
const installment = (due: number, balanceMinor: number | null, principalMinor = 10000) => ({
  dueAt: day(due),
  paymentMinor: 13000,
  interestMinor: 3000,
  principalMinor,
  balanceMinor,
  insuranceMinor: 500,
});
const schedule = (rows = [installment(10, 20000), installment(20, 10000), installment(30, 0)]) =>
  JSON.stringify({ includeInsurance: true, remindersEnabled: false, installments: rows });

describe('schedule-derived remaining principal', () => {
  it('uses end-of-period balances before, between and after instalments, excluding interest and insurance', () => {
    expect(scheduledPrincipal(schedule(), day(1))).toBe(30000);
    expect(scheduledPrincipal(schedule(), day(10) + 3600000)).toBe(30000);
    expect(scheduledPrincipal(schedule(), day(15))).toBe(20000);
    expect(scheduledPrincipal(schedule(), day(25))).toBe(10000);
    expect(scheduledPrincipal(schedule(), day(31))).toBe(0);
  });
  it('uses either adjacent balance anchor when one is unavailable', () => {
    expect(
      scheduledPrincipal(schedule([installment(10, 20000), installment(20, null)]), day(15)),
    ).toBe(20000);
    expect(
      scheduledPrincipal(schedule([installment(10, null), installment(20, 10000)]), day(15)),
    ).toBe(20000);
  });
  it('does not equate an ended partial schedule to a paid-off loan', () => {
    expect(scheduledPrincipal(schedule([installment(10, 20000)]), day(31))).toBe(20000);
    expect(scheduledPrincipal(schedule([installment(10, null)]), day(31))).toBeNull();
  });
  it('does not sum principal from potentially incomplete rows or invent missing balances', () => {
    expect(scheduledPrincipal(schedule([installment(10, null)]), day(1))).toBeNull();
    expect(scheduledPrincipal(schedule([]), day(15))).toBeNull();
    expect(scheduledPrincipal('{', day(15))).toBeNull();
    expect(
      scheduledPrincipal(schedule([installment(20, 10), installment(10, 20)]), day(15)),
    ).toBeNull();
    expect(
      scheduledPrincipal(schedule([installment(10, 20000), installment(20, 5000)]), day(15)),
    ).toBeNull();
  });
});

const account = { id: 1, name: 'Synthetic account', currency: 'RON', openingBalanceMinor: 50000 };
const asset = { id: 'asset-1', name: 'Synthetic asset', symbol: 'SYN', kind: 'stock' as const };
const tx = {
  accountId: 1,
  type: 'expense' as const,
  status: 'confirmed' as const,
  amountMinor: 1000,
  currency: 'RON',
  transferAccountId: null,
  transferAmountMinor: null,
  occurredAt: day(5),
};
const input = {
  baseCurrency: 'RON',
  asOf: day(15),
  accounts: [account],
  transactions: [tx],
  assets: [asset],
  valuations: [{ assetId: asset.id, currency: 'EUR', amountMinor: 10000, valuedAt: day(12) }],
  loans: [{ id: 1, name: 'Synthetic loan', currency: 'RON', installmentsJson: schedule() }],
  rates: [{ currency: 'EUR', rateToBase: 5, effectiveAt: day(1) }],
};

describe('net worth', () => {
  it('adds confirmed account balances and valued investments minus principal', () => {
    const result = calculateNetWorth(input);
    expect(result.accounts.knownMinor).toBe(49000);
    expect(result.investments.knownMinor).toBe(50000);
    expect(result.loans.knownMinor).toBe(20000);
    expect(result.netMinor).toBe(79000);
    expect(result.status).toBe('complete');
  });
  it('handles signed balances, income, transfers with target amounts, drafts and future movements', () => {
    const result = calculateNetWorth({
      ...input,
      accounts: [account, { ...account, id: 2, currency: 'EUR', openingBalanceMinor: -10000 }],
      assets: [],
      loans: [],
      transactions: [
        tx,
        { ...tx, type: 'income', amountMinor: 500 },
        { ...tx, status: 'draft', amountMinor: 99999 },
        { ...tx, occurredAt: day(20), amountMinor: 99999 },
        {
          ...tx,
          type: 'transfer',
          amountMinor: 5000,
          transferAccountId: 2,
          transferAmountMinor: 1000,
        },
      ],
    });
    expect(result.accounts.knownMinor).toBe(-500);
    expect(result.netMinor).toBe(-500);
    expect(result.status).toBe('complete');
  });
  it('does not silently invent the receiving side of a cross-currency transfer', () => {
    const result = calculateNetWorth({
      ...input,
      accounts: [account, { ...account, id: 2, currency: 'EUR' }],
      transactions: [{ ...tx, type: 'transfer', transferAccountId: 2 }],
    });
    expect(result.accounts.rows[1]).toMatchObject({ baseMinor: null, reason: 'unknownBalance' });
    expect(result.status).toBe('partial');
  });
  it('flags source currency mismatches instead of adding unlike amounts', () => {
    const result = calculateNetWorth({ ...input, transactions: [{ ...tx, currency: 'USD' }] });
    expect(result.accounts.rows[0].reason).toBe('unknownBalance');
  });
  it('uses the latest nonfuture dated rate, with valuation-date rates for investments', () => {
    const result = calculateNetWorth({
      ...input,
      accounts: [{ ...account, currency: 'EUR' }],
      transactions: [],
      rates: [
        { currency: 'EUR', rateToBase: 8, effectiveAt: day(20) },
        { currency: 'EUR', rateToBase: 7, effectiveAt: day(14) },
        { currency: 'EUR', rateToBase: 6, effectiveAt: day(11) },
        { currency: 'EUR', rateToBase: 5, effectiveAt: day(1) },
      ],
    });
    expect(result.accounts.knownMinor).toBe(350000);
    expect(result.investments.knownMinor).toBe(60000);
    expect(result.investments.rows[0].rateAt).toBe(day(11));
    expect(result.accounts.rows[0].rateAt).toBe(day(14));
  });
  it('exposes missing rates and invalid rates rather than treating foreign amounts as zero', () => {
    for (const rates of [
      [],
      [{ currency: 'EUR', rateToBase: 5, effectiveAt: day(20) }],
      [{ currency: 'EUR', rateToBase: NaN, effectiveAt: day(1) }],
      [{ currency: 'EUR', rateToBase: -1, effectiveAt: day(1) }],
    ]) {
      const result = calculateNetWorth({ ...input, rates });
      expect(result.investments).toMatchObject({ knownMinor: null, status: 'unknown' });
      expect(result.investments.rows[0].reason).toBe('missingRate');
      expect(result.netMinor).toBe(29000);
      expect(result.status).toBe('partial');
      expect(result.unknownCount).toBe(1);
    }
  });
  it('rounds converted minor units and preserves unknown conversion on overflow', () => {
    expect(
      calculateNetWorth({
        ...input,
        rates: [{ currency: 'EUR', rateToBase: 1.23456, effectiveAt: day(1) }],
      }).investments.knownMinor,
    ).toBe(12346);
    expect(
      calculateNetWorth({
        ...input,
        rates: [{ currency: 'EUR', rateToBase: Number.MAX_VALUE, effectiveAt: day(1) }],
      }).investments.rows[0].reason,
    ).toBe('invalidAmount');
  });
  it('never counts a tracked symbol or movement alert as a monetary holding', () => {
    const missing = calculateNetWorth({ ...input, valuations: [] });
    expect(missing.investments.rows[0].reason).toBe('missingValuation');
    expect(missing.status).toBe('partial');
    const future = calculateNetWorth({
      ...input,
      valuations: [{ ...input.valuations[0], valuedAt: day(20) }],
    });
    expect(future.investments.knownMinor).toBeNull();
  });
  it('ignores valuations for removed assets and honours explicit zero holdings', () => {
    expect(calculateNetWorth({ ...input, assets: [] }).investments.knownMinor).toBe(0);
    expect(
      calculateNetWorth({
        ...input,
        valuations: [{ ...input.valuations[0], amountMinor: 0 }],
      }).investments,
    ).toMatchObject({ knownMinor: 0, status: 'complete' });
  });
  it('retains explicit unknown loan liability in the total status', () => {
    const result = calculateNetWorth({
      ...input,
      loans: [{ ...input.loans[0], installmentsJson: schedule([installment(10, null)]) }],
    });
    expect(result.loans.rows[0].reason).toBe('unknownPrincipal');
    expect(result.netMinor).toBe(99000);
    expect(result.status).toBe('partial');
  });
  it('returns unknown, not zero, when all positions are unknown', () => {
    const result = calculateNetWorth({
      ...input,
      accounts: [],
      loans: [],
      valuations: [],
    });
    expect(result.netMinor).toBeNull();
    expect(result.status).toBe('unknown');
  });
  it('keeps an unreadable investment registry visible as missing data', () => {
    const result = calculateNetWorth({ ...input, assets: [], investmentsInvalid: true });
    expect(result.investments.status).toBe('unknown');
    expect(result.status).toBe('partial');
  });
  it('distinguishes no tracked positions from unknown positions', () => {
    expect(calculateNetWorth({ ...input, accounts: [], assets: [], loans: [] })).toMatchObject({
      netMinor: 0,
      unknownCount: 0,
      status: 'complete',
    });
  });
  it('does not publish an unsafe section or overall subtotal', () => {
    const result = calculateNetWorth({
      ...input,
      assets: [],
      loans: [],
      transactions: [],
      accounts: [
        { ...account, openingBalanceMinor: Number.MAX_SAFE_INTEGER },
        { ...account, id: 2, openingBalanceMinor: 1 },
      ],
    });
    expect(result.accounts.knownMinor).toBeNull();
    expect(result.netMinor).toBeNull();
    expect(result.status).toBe('unknown');
  });
});
