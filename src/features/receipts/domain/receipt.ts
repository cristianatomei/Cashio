export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const MAX_BACKUP_RECEIPT_BYTES = 20 * 1024 * 1024;
export const MAX_BACKUP_JSON_BYTES = 64 * 1024 * 1024;

export function checkBackupJsonSize(json: string): void {
  if (json.length > MAX_BACKUP_JSON_BYTES) throw new ReceiptError('backupLimit');
  let bytes = 0;
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      i + 1 < json.length &&
      json.charCodeAt(i + 1) >= 0xdc00 &&
      json.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
    if (bytes > MAX_BACKUP_JSON_BYTES) throw new ReceiptError('backupLimit');
  }
}

export type ReceiptErrorCode =
  | 'permission'
  | 'unsupported'
  | 'tooLarge'
  | 'backupLimit'
  | 'missing'
  | 'importFailed'
  | 'saveFailed'
  | 'cleanupFailed'
  | 'restoreCleanupFailed'
  | 'interrupted'
  | 'invalidBackup';

export class ReceiptError extends Error {
  constructor(public readonly code: ReceiptErrorCode) {
    super(`Receipt: ${code}`);
  }
}

export type PortableReceipt = { transactionId: number; base64: string };

export function checkReceiptSize(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0) throw new ReceiptError('importFailed');
  if (size > MAX_RECEIPT_BYTES) throw new ReceiptError('tooLarge');
}

export function receiptExtension(bytes: Uint8Array): 'jpg' | 'png' | 'webp' {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value))
    return 'png';
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'webp';
  throw new ReceiptError('unsupported');
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Size(value: string): number {
  if (
    !value.length ||
    value.length > Math.ceil(MAX_RECEIPT_BYTES / 3) * 4 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    throw new ReceiptError('invalidBackup');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const size = (value.length / 4) * 3 - padding;
  checkReceiptSize(size);
  return size;
}

export function base64Header(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < Math.min(value.length, 16); i += 4) {
    const n =
      (alphabet.indexOf(value[i]) << 18) |
      (alphabet.indexOf(value[i + 1]) << 12) |
      (Math.max(0, alphabet.indexOf(value[i + 2])) << 6) |
      Math.max(0, alphabet.indexOf(value[i + 3]));
    bytes.push((n >> 16) & 255);
    if (value[i + 2] !== '=') bytes.push((n >> 8) & 255);
    if (value[i + 3] !== '=') bytes.push(n & 255);
  }
  return new Uint8Array(bytes);
}

export function validatePortableReceipts(
  value: unknown,
  transactionIds: Set<number>,
): PortableReceipt[] {
  if (!Array.isArray(value)) throw new ReceiptError('invalidBackup');
  const seen = new Set<number>();
  let total = 0;
  for (const receipt of value) {
    if (
      typeof receipt !== 'object' ||
      receipt === null ||
      !Number.isSafeInteger(receipt.transactionId) ||
      receipt.transactionId <= 0 ||
      !transactionIds.has(receipt.transactionId) ||
      seen.has(receipt.transactionId) ||
      typeof receipt.base64 !== 'string'
    )
      throw new ReceiptError('invalidBackup');
    total += base64Size(receipt.base64);
    receiptExtension(base64Header(receipt.base64));
    if (total > MAX_BACKUP_RECEIPT_BYTES) throw new ReceiptError('backupLimit');
    seen.add(receipt.transactionId);
  }
  return value as PortableReceipt[];
}
