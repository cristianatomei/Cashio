import { projectStoredLoanPayments } from './storedSchedule';

describe('projectStoredLoanPayments', () => {
  const firstDueAt = new Date(2026, 10, 5).getTime();
  const secondDueAt = new Date(2026, 11, 5).getTime();
  const installment = {
    paymentMinor: 100000,
    interestMinor: 20000,
    principalMinor: 80000,
    balanceMinor: 500000,
    insuranceMinor: 1250,
  };
  const schedule = (includeInsurance: boolean) => ({
    id: 1,
    currency: 'RON',
    installmentsJson: JSON.stringify({
      includeInsurance,
      remindersEnabled: false,
      installments: [
        { ...installment, dueAt: firstDueAt },
        { ...installment, dueAt: secondDueAt, paymentMinor: 102500 },
      ],
    }),
  });

  it('projects each varying installment amount and due date with optional insurance', () => {
    expect(projectStoredLoanPayments([schedule(true)], firstDueAt, secondDueAt + 1)).toEqual([
      {
        scheduleId: 1,
        dueAt: firstDueAt,
        amountMinor: 101250,
        currency: 'RON',
      },
      {
        scheduleId: 1,
        dueAt: secondDueAt,
        amountMinor: 103750,
        currency: 'RON',
      },
    ]);
    expect(projectStoredLoanPayments([schedule(false)], firstDueAt, secondDueAt + 1)).toEqual([
      {
        scheduleId: 1,
        dueAt: firstDueAt,
        amountMinor: 100000,
        currency: 'RON',
      },
      {
        scheduleId: 1,
        dueAt: secondDueAt,
        amountMinor: 102500,
        currency: 'RON',
      },
    ]);
  });

  it('returns no projections when the range has no due installments', () => {
    expect(
      projectStoredLoanPayments(
        [schedule(true)],
        new Date(2027, 0, 1).getTime(),
        new Date(2027, 1, 1).getTime(),
      ),
    ).toEqual([]);
    expect(projectStoredLoanPayments([schedule(true)], secondDueAt, firstDueAt)).toEqual([]);
  });
});
