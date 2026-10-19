import { parseStoredLoanSchedule, updateStoredLoanScheduleSettings } from './loanScheduleRepo';

describe('parseStoredLoanSchedule', () => {
  const valid = {
    includeInsurance: true,
    remindersEnabled: false,
    installments: [
      {
        dueAt: new Date(2026, 10, 10).getTime(),
        paymentMinor: 100000,
        interestMinor: 20000,
        principalMinor: 80000,
        balanceMinor: 500000,
        insuranceMinor: 1000,
      },
    ],
  };

  it('reads saved variable instalments', () => {
    expect(parseStoredLoanSchedule(JSON.stringify(valid))).toEqual(valid);
  });

  it('rejects malformed schedule data', () => {
    expect(() => parseStoredLoanSchedule('{')).toThrow(SyntaxError);
    expect(() =>
      parseStoredLoanSchedule(
        JSON.stringify({
          ...valid,
          installments: [{ ...valid.installments[0], paymentMinor: -1 }],
        }),
      ),
    ).toThrow('Stored loan schedule data is invalid.');
  });

  it('updates insurance settings without changing installments or reminder preference', () => {
    const updated = JSON.parse(
      updateStoredLoanScheduleSettings(JSON.stringify(valid), { includeInsurance: false }),
    );
    expect(updated).toEqual({ ...valid, includeInsurance: false });
  });
});
