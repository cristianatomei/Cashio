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

  it('requires recognizable transaction columns', () => {
    expect(() => parseIngCsv('foo;bar\nx;y')).toThrow('transaction date, amount, and description');
  });

  it('rejects malformed quoted fields', () => {
    expect(() => parseIngCsv('Data;Descriere;Sumă\n01.01.2025;"unterminated;1')).toThrow(
      'unterminated quoted field',
    );
  });
});
