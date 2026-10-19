import { matchesCapturedPayment } from './capturedPaymentMatch';

describe('matchesCapturedPayment', () => {
  const imported = {
    date: new Date(2026, 9, 10).getTime(),
    amountMinor: -125000,
    currency: 'RON',
    description: 'Rata credit ipotecar ING',
  };

  it('recognizes the same captured payment when the bank description adds details', () => {
    expect(
      matchesCapturedPayment(imported, {
        type: 'expense',
        amountMinor: 125000,
        currency: 'RON',
        merchantRaw: 'Rata credit ipotecar ING · contract 12345',
      }),
    ).toBe(true);
  });

  it('does not treat different amounts, currencies, or descriptions as duplicates', () => {
    expect(
      matchesCapturedPayment(imported, {
        type: 'expense',
        amountMinor: 125001,
        currency: 'RON',
        merchantRaw: 'Rata credit ipotecar ING',
      }),
    ).toBe(false);
    expect(
      matchesCapturedPayment(imported, {
        type: 'expense',
        amountMinor: 125000,
        currency: 'EUR',
        merchantRaw: 'Rata credit ipotecar ING',
      }),
    ).toBe(false);
    expect(
      matchesCapturedPayment(imported, {
        type: 'expense',
        amountMinor: 125000,
        currency: 'RON',
        merchantRaw: 'Supermarket',
      }),
    ).toBe(false);
  });
});
