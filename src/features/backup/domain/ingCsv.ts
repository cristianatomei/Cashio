import { parseSignedAmountToMinor } from '@/core/utils/money';

export type IngTransactionRow = {
  date: number;
  amountMinor: number;
  currency: string;
  description: string;
};

export type IngCsvResult = {
  rows: IngTransactionRow[];
  skippedRows: number;
};

const HEADER_ALIASES = {
  date: [
    'data',
    'data tranzactiei',
    'data tranzactiei',
    'data decontarii',
    'date',
    'transaction date',
  ],
  amount: ['suma', 'valoare', 'amount', 'debit credit', 'credit debit'],
  debit: ['debit', 'debit suma', 'debit amount'],
  credit: ['credit', 'credit suma', 'credit amount'],
  currency: ['moneda', 'valuta', 'currency'],
  description: [
    'descriere',
    'detalii',
    'detalii tranzactie',
    'descriere tranzactie',
    'description',
    'details',
  ],
} as const;

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro-RO')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCsvRecords(csv: string): string[][] {
  const source = csv.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = ([';', ',', '\t'] as const).reduce(
    (best, item) => {
      const count = firstLine.split(item).length - 1;
      return count > best.count ? { delimiter: item, count } : best;
    },
    { delimiter: ';' as string, count: 0 },
  ).delimiter;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      row.push(field);
      field = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('The CSV contains an unterminated quoted field.');
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function findColumn(headers: string[], aliases: readonly string[]): number {
  const candidates = new Set(aliases.map(normalizeHeader));
  return headers.findIndex((header) => candidates.has(normalizeHeader(header)));
}

function parseDate(value: string): number | null {
  const trimmed = value.trim();
  const dayFirst = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(trimmed);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day)
    )
      return null;
    return date.getTime();
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const [, year, month, day] = iso;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day)
    )
      return null;
    return date.getTime();
  }
  const romanianDate = /^(\d{1,2})\s+([a-zăâîșț]+)\s+(\d{4})$/i.exec(trimmed);
  if (romanianDate) {
    const monthByName: Record<string, number> = {
      ianuarie: 0,
      februarie: 1,
      martie: 2,
      aprilie: 3,
      mai: 4,
      iunie: 5,
      iulie: 6,
      august: 7,
      septembrie: 8,
      octombrie: 9,
      noiembrie: 10,
      decembrie: 11,
    };
    const day = Number(romanianDate[1]);
    const month = monthByName[normalizeHeader(romanianDate[2])];
    const year = Number(romanianDate[3]);
    if (month === undefined) return null;
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day)
      return null;
    return date.getTime();
  }
  return null;
}

export function parseIngCsv(csv: string): IngCsvResult {
  const records = parseCsvRecords(csv);
  if (records.length < 2) throw new Error('The CSV does not contain transaction rows.');

  const headers = records[0];
  const dateColumn = findColumn(headers, HEADER_ALIASES.date);
  const amountColumn = findColumn(headers, HEADER_ALIASES.amount);
  const debitColumn = findColumn(headers, HEADER_ALIASES.debit);
  const creditColumn = findColumn(headers, HEADER_ALIASES.credit);
  const currencyColumn = findColumn(headers, HEADER_ALIASES.currency);
  const descriptionColumn = findColumn(headers, HEADER_ALIASES.description);

  if (
    dateColumn < 0 ||
    descriptionColumn < 0 ||
    (amountColumn < 0 && debitColumn < 0 && creditColumn < 0)
  ) {
    throw new Error('The CSV must include transaction date, amount, and description columns.');
  }

  const rows: IngTransactionRow[] = [];
  let skippedRows = 0;
  for (const values of records.slice(1)) {
    const date = parseDate(values[dateColumn] ?? '');
    if (date === null && !(values[dateColumn] ?? '').trim() && rows.length > 0) {
      const detail = values
        .filter(
          (value, index) =>
            index !== amountColumn &&
            index !== debitColumn &&
            index !== creditColumn &&
            index !== currencyColumn,
        )
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' · ');
      if (detail) {
        rows[rows.length - 1].description += ` · ${detail}`;
        continue;
      }
    }
    const description = (values[descriptionColumn] ?? '').trim();
    let amountMinor: number | null = null;
    if (amountColumn >= 0) {
      amountMinor = parseSignedAmountToMinor(values[amountColumn] ?? '');
    } else {
      const debit = parseSignedAmountToMinor(values[debitColumn] ?? '');
      const credit = parseSignedAmountToMinor(values[creditColumn] ?? '');
      if (debit !== null && credit !== null) {
        amountMinor =
          debit !== 0 && credit !== 0 ? null : debit !== 0 ? -Math.abs(debit) : Math.abs(credit);
      }
    }

    if (date === null || amountMinor === null || amountMinor === 0 || !description) {
      skippedRows += 1;
      continue;
    }
    rows.push({
      date,
      amountMinor,
      currency: (currencyColumn < 0 ? 'RON' : values[currencyColumn] || 'RON').trim().toUpperCase(),
      description,
    });
  }

  if (rows.length === 0) throw new Error('No valid transactions were found in the CSV.');
  return { rows, skippedRows };
}
