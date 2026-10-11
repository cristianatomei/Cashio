import {
  installmentTotal,
  parseIngLoanSchedule,
  upcomingInstallments,
} from './ingSchedule';

describe('parseIngLoanSchedule', () => {
  const header =
    'Moneda RON\n' +
    'Data următoarei plăți Suma de plată Dobânda Rata capital Capital datorat la sfârșitul perioadei Prima asigurare';

  it('parses a personal-loan schedule and reads optional insurance separately', () => {
    const schedule = parseIngLoanSchedule(
      `${header}\n` +
        '10.11.2026 1.234.50 400.25 834.25 19.165.75 12.00\n' +
        '10.12.2026 1.234.50 395.00 839.50 18.326.25 12.00\n',
    );
    expect(schedule.currency).toBe('RON');
    expect(schedule.installments).toEqual([
      {
        dueAt: new Date(2026, 10, 10).getTime(),
        paymentMinor: 123450,
        interestMinor: 40025,
        principalMinor: 83425,
        balanceMinor: 1916575,
        insuranceMinor: 1200,
      },
      {
        dueAt: new Date(2026, 11, 10).getTime(),
        paymentMinor: 123450,
        interestMinor: 39500,
        principalMinor: 83950,
        balanceMinor: 1832625,
        insuranceMinor: 1200,
      },
    ]);
    expect(installmentTotal(schedule.installments[0], true)).toBe(124650);
    expect(installmentTotal(schedule.installments[0], false)).toBe(123450);
  });

  it('parses mortgage rows with changing instalments and optional balance data', () => {
    const schedule = parseIngLoanSchedule(
      `${header}\n` +
        '10.11.2026 2.100.00 1.400.00 700.00 250.000.0 22.50\n' +
        '10.12.2026 2.095.00 1.395.00 700.00\n',
    );
    expect(schedule.installments).toHaveLength(2);
    expect(schedule.installments[0].balanceMinor).toBe(25000000);
    expect(schedule.installments[0].insuranceMinor).toBe(2250);
    expect(schedule.installments[1]).toMatchObject({
      paymentMinor: 209500,
      interestMinor: 139500,
      principalMinor: 70000,
      balanceMinor: null,
      insuranceMinor: 0,
    });
  });

  it('rejects unrelated PDFs and missing currency instead of guessing', () => {
    expect(() => parseIngLoanSchedule('invoice date total')).toThrow(
      'recognized ING repayment schedule',
    );
    expect(() =>
      parseIngLoanSchedule(
        'Data următoarei plăți Suma de plată Dobânda Rata capital\n10.11.2026 1.00 0.20 0.80',
      ),
    ).toThrow('does not specify its currency');
  });

  it('returns upcoming instalments from the current local day', () => {
    const schedule = parseIngLoanSchedule(
      `${header}\n` +
        '10.10.2026 100.00 20.00 80.00\n' +
        '10.11.2026 100.00 18.00 82.00\n' +
        '10.12.2026 100.00 16.00 84.00\n',
    );
    const upcoming = upcomingInstallments(schedule, new Date(2026, 9, 10, 16).getTime(), 1);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].dueAt).toBe(new Date(2026, 9, 10).getTime());
  });
});
