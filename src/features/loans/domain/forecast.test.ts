import { estimateWithLoanSchedules } from './forecast';
import { suggestLoanPayments } from './reconciliation';

const date = (month: number, day: number) => new Date(2026, month - 1, day).getTime();
const installment = (month: number, day: number, paymentMinor: number) => ({
  dueAt: date(month, day),
  paymentMinor,
  interestMinor: 20000,
  principalMinor: paymentMinor - 20000,
  insuranceMinor: 1000,
  balanceMinor: 500000,
});
const installments = [
  installment(9, 10, 100000),
  installment(11, 10, 110000),
  installment(11, 25, 90000),
];
const schedule = {
  id: 1,
  currency: 'RON',
  recurringId: 7,
  installmentsJson: JSON.stringify({
    includeInsurance: true,
    remindersEnabled: false,
    installments,
  }),
};
const rule = {
  id: 7,
  type: 'expense',
  name: 'Loan',
  amountMinor: 999999,
  currency: 'RON',
  frequency: 'monthly' as const,
  interval: 1,
  nextDue: date(9, 10),
  endAt: null,
  active: true,
};
const payment = {
  id: 2,
  type: 'expense',
  status: 'confirmed',
  amountMinor: 101000,
  currency: 'RON',
  occurredAt: date(9, 11),
  source: 'notification',
  recurringId: null,
  merchantRaw: 'Rata credit',
  note: null,
};
const input = {
  schedules: [schedule],
  rules: [rule],
  links: [],
  transactions: [],
  now: date(10, 29),
  targetFrom: date(11, 1),
  targetTo: date(12, 1),
  historyFrom: date(8, 1),
  historyTo: date(11, 1),
};
const link = { scheduleId: 1, dueAt: date(9, 10), transactionId: 2 };

it('uses distinct variable installments and insurance, replacing only an explicitly linked rule', () => {
  expect(estimateWithLoanSchedules(input)).toEqual([
    { currency: 'RON', obligationsMinor: 202000, variableAverageMinor: 0, totalMinor: 202000 },
  ]);
  expect(
    estimateWithLoanSchedules({
      ...input,
      schedules: [
        {
          ...schedule,
          installmentsJson: JSON.stringify({
            includeInsurance: false,
            remindersEnabled: false,
            installments,
          }),
        },
      ],
    })[0].obligationsMinor,
  ).toBe(200000);
  expect(JSON.parse(schedule.installmentsJson).installments).toEqual(installments);
});

it('does not replace unlinked rules with matching names or include recurring income', () => {
  expect(
    estimateWithLoanSchedules({
      ...input,
      rules: [
        { ...rule, id: 8 },
        { ...rule, id: 9, type: 'income' },
      ],
    })[0].obligationsMinor,
  ).toBe(1201999);
});

it('does not invent installments in a gap or beyond the schedule', () => {
  expect(
    estimateWithLoanSchedules({
      ...input,
      targetFrom: date(10, 1),
      targetTo: date(11, 1),
    }),
  ).toEqual([]);
  expect(
    estimateWithLoanSchedules({
      ...input,
      targetFrom: date(12, 1),
      targetTo: date(12, 31),
    }),
  ).toEqual([]);
});

it('does not settle even a unique, exact heuristic suggestion without explicit confirmation', () => {
  const futurePayment = { ...payment, occurredAt: date(11, 11), amountMinor: 111000 };
  expect(
    suggestLoanPayments([{ ...schedule, includeInsurance: true, installments }], [futurePayment]),
  ).toHaveLength(1);
  expect(
    estimateWithLoanSchedules({
      ...input,
      now: date(11, 12),
      transactions: [futurePayment],
    })[0].obligationsMinor,
  ).toBe(202000);
});

it('excludes a confirmed linked payment from history exactly once regardless of text', () => {
  const genericPayment = { ...payment, merchantRaw: 'Bank transfer' };
  expect(
    estimateWithLoanSchedules({
      ...input,
      links: [link],
      transactions: [genericPayment],
    })[0].variableAverageMinor,
  ).toBe(0);
  expect(
    estimateWithLoanSchedules({
      ...input,
      transactions: [payment],
    })[0].variableAverageMinor,
  ).toBe(Math.round(101000 / 3));
});

it('excludes manually imported recurring-linked payments from variable history', () => {
  expect(
    estimateWithLoanSchedules({
      ...input,
      transactions: [{ ...payment, recurringId: rule.id }],
    })[0].variableAverageMinor,
  ).toBe(0);
});

it('reserves the unpaid difference, never a negative amount or a fixed recurring substitute', () => {
  const futureLink = { ...link, dueAt: date(11, 10) };
  const earlyPayment = { ...payment, amountMinor: 100000 };
  expect(
    estimateWithLoanSchedules({
      ...input,
      links: [futureLink],
      transactions: [earlyPayment],
    })[0],
  ).toEqual({
    currency: 'RON',
    obligationsMinor: 102000,
    variableAverageMinor: 0,
    totalMinor: 102000,
  });
  expect(
    estimateWithLoanSchedules({
      ...input,
      links: [futureLink],
      transactions: [{ ...earlyPayment, amountMinor: 200000 }],
    })[0].obligationsMinor,
  ).toBe(91000);
});

it.each([
  { status: 'draft' },
  { type: 'income' },
  { currency: 'EUR' },
  { occurredAt: date(11, 2) },
  { recurringId: 99 },
])('does not trust an incompatible persisted association (%j)', (change) => {
  const result = estimateWithLoanSchedules({
    ...input,
    links: [{ ...link, dueAt: date(11, 10) }],
    transactions: [{ ...payment, ...change }],
  });
  expect(result.find((item) => item.currency === 'RON')!.obligationsMinor).toBe(202000);
});

it('does not apply one transaction to two installments even for malformed duplicate links', () => {
  expect(
    estimateWithLoanSchedules({
      ...input,
      links: [
        { ...link, dueAt: date(11, 10) },
        { ...link, dueAt: date(11, 25) },
      ],
      transactions: [payment],
    })[0].obligationsMinor,
  ).toBe(101000);
});
