import { Buffer } from 'buffer';

import {
  MAX_BACKUP_JSON_BYTES,
  MAX_RECEIPT_BYTES,
  base64Size,
  checkBackupJsonSize,
  receiptExtension,
  validatePortableReceipts,
} from './receipt';
import { syntheticJpeg } from '../testing/fileSystem';

const image = (size: number) => {
  const buffer = Buffer.alloc(size);
  syntheticJpeg.copy(buffer);
  return buffer.toString('base64');
};

it('recognizes supported image signatures and rejects other formats', () => {
  expect(receiptExtension(syntheticJpeg)).toBe('jpg');
  expect(receiptExtension(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('png');
  expect(receiptExtension(Buffer.from('RIFF0000WEBP'))).toBe('webp');
  expect(() => receiptExtension(Buffer.from('file:///not-an-image'))).toThrow('unsupported');
});

it('validates base64 size, padding, malformed, empty and oversized payloads', () => {
  expect(base64Size(image(MAX_RECEIPT_BYTES))).toBe(MAX_RECEIPT_BYTES);
  expect(base64Size('AQ==')).toBe(1);
  expect(base64Size('AQI=')).toBe(2);
  for (const invalid of ['', 'A', '====', 'abc$', 'ab=c', 'data:image/jpeg;base64,AAAA']) {
    expect(() => base64Size(invalid)).toThrow('invalidBackup');
  }
  expect(() => base64Size(image(MAX_RECEIPT_BYTES + 1))).toThrow();
});

it('requires valid unique transaction links and image content', () => {
  const receipt = { transactionId: 1, base64: syntheticJpeg.toString('base64') };
  expect(validatePortableReceipts([receipt], new Set([1]))).toEqual([receipt]);
  expect(() => validatePortableReceipts([receipt], new Set())).toThrow('invalidBackup');
  expect(() => validatePortableReceipts([receipt, receipt], new Set([1]))).toThrow('invalidBackup');
  expect(() => validatePortableReceipts(undefined, new Set())).toThrow('invalidBackup');
  expect(() =>
    validatePortableReceipts([{ ...receipt, base64: 'dGV4dA==' }], new Set([1])),
  ).toThrow('unsupported');
});

it('allows exactly 20 MiB in total and refuses larger backups without dropping receipts', () => {
  const base64 = image(MAX_RECEIPT_BYTES);
  const receipts = [1, 2, 3, 4].map((transactionId) => ({ transactionId, base64 }));
  const ids = new Set([1, 2, 3, 4, 5]);
  expect(validatePortableReceipts(receipts, ids)).toHaveLength(4);
  expect(() =>
    validatePortableReceipts(
      [...receipts, { transactionId: 5, base64: syntheticJpeg.toString('base64') }],
      ids,
    ),
  ).toThrow('backupLimit');
});

it('bounds complete JSON by UTF-8 bytes, not JS character count', () => {
  expect(() => checkBackupJsonSize('a'.repeat(MAX_BACKUP_JSON_BYTES + 1))).toThrow('backupLimit');
  expect(() => checkBackupJsonSize('ș'.repeat(MAX_BACKUP_JSON_BYTES / 2 + 1))).toThrow(
    'backupLimit',
  );
  expect(() => checkBackupJsonSize('💸'.repeat(MAX_BACKUP_JSON_BYTES / 4 + 1))).toThrow(
    'backupLimit',
  );
  expect(() => checkBackupJsonSize('{"note":"Bon 💸"}')).not.toThrow();
});
