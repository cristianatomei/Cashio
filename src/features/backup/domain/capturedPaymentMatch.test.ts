import { findUnusedCapturedPayment, matchesCapturedPayment } from './capturedPaymentMatch';

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

  it('uses each captured payment at most once for identical imported rows', () => {
    const captured = {
      id: 1,
      type: 'expense',
      amountMinor: 125000,
      currency: 'RON',
      merchantRaw: 'Rata credit ipotecar ING',
    };
    const used = new Set<number>();
    const match = findUnusedCapturedPayment(imported, [captured], used);
    expect(match?.id).toBe(1);
    used.add(match!.id);
    expect(findUnusedCapturedPayment(imported, [captured], used)).toBeUndefined();
    expect(findUnusedCapturedPayment(imported, [captured, { ...captured, id: 2 }], used)?.id).toBe(2);
  });
});
