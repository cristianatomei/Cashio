import { parseIngCsv } from './ingCsv';

describe('parseIngCsv', () => {
  it('parses semicolon-delimited Romanian headers and quoted descriptions', () => {
    const result = parseIngCsv(
      '\uFEFFData tranzacției;Descriere;Sumă;Monedă\r\n' +
        '15.03.2025;"Cafea; centru";-12,50;RON\r\n' +
        '16.03.2025;Salariu;4.500,00;RON',
    );
    expect(result.rows).toEqual([
      {
        date: new Date(2025, 2, 15).getTime(),
        amountMinor: -1250,
        currency: 'RON',
        description: 'Cafea; centru',
      },
      {
        date: new Date(2025, 2, 16).getTime(),
        amountMinor: 450000,
        currency: 'RON',
        description: 'Salariu',
      },
    ]);
    expect(result.skippedRows).toBe(0);
  });

  it('supports separate debit and credit columns and skips malformed rows', () => {
    const result = parseIngCsv(
      'Date,Description,Debit,Credit,Currency\n' +
        '2025-02-01,Groceries,55.20,,RON\n' +
        '2025-02-02,Refund,,10.00,RON\n' +
        'not-a-date,Wrong row,8.00,,RON',
    );
    expect(result.rows.map((row) => row.amountMinor)).toEqual([-5520, 1000]);
    expect(result.skippedRows).toBe(1);
  });

  it('parses the multiline Romanian Home’Bank statement layout', () => {
    const result = parseIngCsv(
      'Data,Detalii tranzactie,Debit,Credit\r\n' +
        '30 septembrie 2013,Plata debit direct,"120,19",\r\n' +
        ',Beneficiar: RCS AND RDS SA,,\r\n' +
        ',Referinta: 70979872,,\r\n',
    );
    expect(result.rows).toEqual([
      {
        date: new Date(2013, 8, 30).getTime(),
        amountMinor: -12019,
        currency: 'RON',
        description: 'Plata debit direct · Beneficiar: RCS AND RDS SA · Referinta: 70979872',
      },
    ]);
    expect(result.skippedRows).toBe(0);
  });

  it('parses paged Home’Bank exports with preamble, shifted columns and footers', () => {
    const result = parseIngCsv(
      'Titular cont: DL Test,,,,,,,,,\n' +
        '"Str. X\n6\n\n061981, Bucuresti, RO",,,,,,,,,\n' +
        ',Data,,,Detalii tranzactie,,,Debit,,Credit\n' +
        '01 octombrie 2026,,,Cumparare POS,,,"112,27",,,\n' +
        ',,,Numar card:**** 7811,,,,,,\n' +
        '01 octombrie 2026,,,Incasare,,,,,"19.694,00",\n' +
        ',,,Detalii:Salariu,,,,,,\n' +
        ',Roxana Petria,,,,Alexandra Ilie,,,,\n' +
        ',,ING Bank N.V. Amsterdam,,,ING Bank N.V. Amsterdam,,,,\n' +
        'Titular cont: DL Test,,,,,,,,\n' +
        ',Data,,,Detalii tranzactie,,,Debit,Credit\n' +
        '02 octombrie 2026,,,Cumparare POS,,,"118,42",,\n' +
        ',,,Tranzactie la:GRAFRELY,,,,,\n' +
        'Sold iniţial:,,,"1.048,22",\n' +
        ',,,Detalii:nu apartine,,,\n',
    );
    expect(result.rows.map((row) => [row.amountMinor, row.description])).toEqual([
      [-11227, 'Cumparare POS · Numar card:**** 7811'],
      [1969400, 'Incasare · Detalii:Salariu'],
      [-11842, 'Cumparare POS · Tranzactie la:GRAFRELY'],
    ]);
  });

  it('requires recognizable transaction columns', () => {
    expect(() => parseIngCsv('foo;bar\nx;y')).toThrow('transaction date, amount, and description');
  });

  it('rejects malformed quoted fields', () => {
    expect(() => parseIngCsv('Data;Descriere;Sumă\n01.01.2025;"unterminated;1')).toThrow(
      'unterminated quoted field',
    );
  });
});
