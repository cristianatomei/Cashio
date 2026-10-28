import {
  discardReceipt,
  exportReceipt,
  importReceipt,
  receiptFile,
  receiptUri,
  stageReceipts,
  sweepReceiptFiles,
} from './files';
import { files, failures, resetFiles, syntheticJpeg } from '../testing/fileSystem';
import { MAX_RECEIPT_BYTES } from '../domain/receipt';
import { Buffer } from 'buffer';

jest.mock('expo-file-system', () => jest.requireActual('../testing/fileSystem'));

beforeEach(resetFiles);

it('copies a local source into private durable storage with independent names', () => {
  files.set('file:///picker/image.jpg', syntheticJpeg);
  const first = importReceipt('file:///picker/image.jpg');
  const second = importReceipt('file:///picker/image.jpg');
  expect(first).not.toBe(second);
  files.delete('file:///picker/image.jpg');
  expect(receiptUri(first)).toContain('/private/documents/receipts/');
  expect(exportReceipt(first)).toBe(syntheticJpeg.toString('base64'));
  discardReceipt(first);
  expect(() => receiptUri(first)).toThrow('missing');
  expect(exportReceipt(second)).toBe(syntheticJpeg.toString('base64'));
});

it('reports missing, nonlocal, unsupported, oversized, read and copy failures without leaking files', () => {
  expect(() => importReceipt('https://invalid.test/image.jpg')).toThrow('importFailed');
  expect(() => importReceipt('file:///missing.jpg')).toThrow('missing');
  files.set('file:///picker/text.jpg', Buffer.from('not an image'));
  expect(() => importReceipt('file:///picker/text.jpg')).toThrow('unsupported');
  files.set('file:///picker/large.jpg', Buffer.alloc(MAX_RECEIPT_BYTES + 1));
  expect(() => importReceipt('file:///picker/large.jpg')).toThrow('tooLarge');
  files.set('file:///picker/image.jpg', syntheticJpeg);
  failures.read = true;
  expect(() => importReceipt('file:///picker/image.jpg')).toThrow('saveFailed');
  failures.read = false;
  failures.copy = true;
  expect(() => importReceipt('file:///picker/image.jpg')).toThrow('saveFailed');
  expect([...files.keys()].filter((name) => name.includes('/receipts/'))).toEqual([]);
});

it('stages portable content under fresh names and removes partially written files on failure', () => {
  const input = [{ transactionId: 7, base64: syntheticJpeg.toString('base64') }];
  const staged = stageReceipts(input);
  expect(exportReceipt(staged[0].filename)).toBe(input[0].base64);
  failures.write = true;
  expect(() => stageReceipts(input)).toThrow('saveFailed');
  expect([...files.keys()]).toEqual([receiptUri(staged[0].filename)]);
});

it('sweeps only orphan receipt files, reports failures and retries later', () => {
  files.set('file:///picker/image.jpg', syntheticJpeg);
  const keep = importReceipt('file:///picker/image.jpg');
  const orphan = importReceipt('file:///picker/image.jpg');
  failures.delete = true;
  expect(() => sweepReceiptFiles(new Set([keep]))).toThrow('cleanupFailed');
  failures.delete = false;
  sweepReceiptFiles(new Set([keep]));
  expect(receiptFile(orphan).exists).toBe(false);
  expect(receiptFile(keep).exists).toBe(true);
  expect(files.has('file:///picker/image.jpg')).toBe(true);
  expect(() => receiptFile('../image.jpg')).toThrow('missing');
});
