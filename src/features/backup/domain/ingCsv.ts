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

type Columns = {
  date: number;
  amount: number;
  debit: number;
  credit: number;
  currency: number;
  description: number;
};

function resolveColumns(headers: string[]): Columns | null {
  const columns: Columns = {
    date: findColumn(headers, HEADER_ALIASES.date),
    amount: findColumn(headers, HEADER_ALIASES.amount),
    debit: findColumn(headers, HEADER_ALIASES.debit),
    credit: findColumn(headers, HEADER_ALIASES.credit),
    currency: findColumn(headers, HEADER_ALIASES.currency),
    description: findColumn(headers, HEADER_ALIASES.description),
  };
  if (
    columns.date < 0 ||
    columns.description < 0 ||
    (columns.amount < 0 && columns.debit < 0 && columns.credit < 0)
  ) {
    return null;
  }
  // Home'Bank PDF-style exports start the header with an empty cell, but transaction rows start at column 0.
  if (!(headers[0] ?? '').trim() && columns.date === 1) {
    for (const key of Object.keys(columns) as (keyof Columns)[]) {
      if (columns[key] > 0) columns[key] -= 1;
    }
  }
  return columns;
}

export function parseIngCsv(csv: string): IngCsvResult {
  const records = parseCsvRecords(csv);
  if (records.length < 2) throw new Error('The CSV does not contain transaction rows.');

  const rows: IngTransactionRow[] = [];
  let skippedRows = 0;
  let columns: Columns | null = null;
  let current: IngTransactionRow | null = null;
  let sawHeader = false;

  for (const values of records) {
    const header = resolveColumns(values);
    if (header) {
      columns = header;
      current = null;
      sawHeader = true;
      continue;
    }
    if (!columns) continue;

    const { date: dateColumn, amount: amountColumn, debit: debitColumn } = columns;
    const { credit: creditColumn, currency: currencyColumn, description: descriptionColumn } = columns;
    const date = parseDate(values[dateColumn] ?? '');

    if (date === null && !(values[dateColumn] ?? '').trim()) {
      const detail = (values[descriptionColumn] ?? '').trim();
      if (current && detail) {
        current.description += ` · ${detail}`;
        continue;
      }
    }

    // Anything that is not a transaction or its detail line (signatures, balances) ends the block.
    current = null;
    if (date === null) {
      skippedRows += 1;
      continue;
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

    if (amountMinor === null || amountMinor === 0 || !description) {
      skippedRows += 1;
      continue;
    }
    current = {
      date,
      amountMinor,
      currency: (currencyColumn < 0 ? 'RON' : values[currencyColumn] || 'RON').trim().toUpperCase(),
      description,
    };
    rows.push(current);
  }

  if (!sawHeader) {
    throw new Error('The CSV must include transaction date, amount, and description columns.');
  }
  if (rows.length === 0) throw new Error('No valid transactions were found in the CSV.');
  return { rows, skippedRows };
}
