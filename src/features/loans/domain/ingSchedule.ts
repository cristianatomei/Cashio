import { parseAmountToMinor } from '@/core/utils/money';

export type LoanInstallment = {
  dueAt: number;
  paymentMinor: number;
  interestMinor: number;
  principalMinor: number;
  balanceMinor: number | null;
  insuranceMinor: number;
};

export type LoanSchedule = {
  currency: string;
  installments: LoanInstallment[];
};

const DATE_AT_LINE_START = /^\s*(\d{2})[./-](\d{2})[./-](\d{4})\s+(.*)$/;
const AMOUNT_TOKEN = /(?<![\w])\d[\d.,]*(?:[.,]\d{1,2})(?!\d)/g;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro-RO')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRomanianDate(day: string, month: string, year: string): number | null {
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date.getTime();
}

function parseAmounts(line: string): number[] {
  return [...line.matchAll(AMOUNT_TOKEN)]
    .map((match) => parseAmountToMinor(match[0]))
    .filter((amount): amount is number => amount !== null);
}

export function parseIngLoanSchedule(text: string): LoanSchedule {
  const normalized = normalizeText(text);
  const requiredHeadings = [
    'data urmatoarei plati',
    'suma de plata',
    'dobanda',
    'rata capital',
  ];
  if (!requiredHeadings.every((heading) => normalized.includes(heading))) {
    throw new Error('The PDF does not contain a recognized ING repayment schedule.');
  }

  const currencyMatch = /\bmoneda\s+([a-z]{3})\b/i.exec(normalized);
  if (!currencyMatch) {
    throw new Error('The repayment schedule does not specify its currency.');
  }

  const installments: LoanInstallment[] = [];
  for (const line of text.split(/\r?\n/)) {
    const dateMatch = DATE_AT_LINE_START.exec(line);
    if (!dateMatch) continue;
    const dueAt = parseRomanianDate(dateMatch[1], dateMatch[2], dateMatch[3]);
    if (dueAt === null) continue;

    const amounts = parseAmounts(dateMatch[4]);
    if (amounts.length < 3) continue;
    installments.push({
      dueAt,
      paymentMinor: amounts[0],
      interestMinor: amounts[1],
      principalMinor: amounts[2],
      balanceMinor: amounts[3] ?? null,
      insuranceMinor: amounts[4] ?? 0,
    });
  }

  if (installments.length === 0) {
    throw new Error('No repayment rows could be read from the ING schedule.');
  }

  installments.sort((left, right) => left.dueAt - right.dueAt);
  return { currency: currencyMatch[1].toUpperCase(), installments };
}

export function upcomingInstallments(
  schedule: LoanSchedule,
  from: number,
  count = 6,
): LoanInstallment[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  return schedule.installments
    .filter((installment) => installment.dueAt >= start.getTime())
    .slice(0, count);
}

export function installmentTotal(installment: LoanInstallment, includeInsurance: boolean): number {
  return installment.paymentMinor + (includeInsurance ? installment.insuranceMinor : 0);
}
