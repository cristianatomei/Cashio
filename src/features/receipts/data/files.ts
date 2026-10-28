import { Directory, File, FileMode, Paths } from 'expo-file-system';

import {
  base64Header,
  base64Size,
  checkReceiptSize,
  receiptExtension,
  ReceiptError,
  type PortableReceipt,
} from '../domain/receipt';

const directory = () => new Directory(Paths.document, 'receipts');
const validName = /^[a-z0-9-]+\.(jpg|png|webp)$/;
let sequence = 0;

export function receiptFile(filename: string): File {
  if (!validName.test(filename)) throw new ReceiptError('missing');
  return new File(directory(), filename);
}

export function receiptUri(filename: string): string {
  const file = receiptFile(filename);
  if (!file.exists) throw new ReceiptError('missing');
  return file.uri;
}

function destination(extension: string): { filename: string; file: File } {
  directory().create({ intermediates: true, idempotent: true });
  const filename = `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}.${extension}`;
  const file = receiptFile(filename);
  if (file.exists) throw new ReceiptError('saveFailed');
  return { filename, file };
}

export function discardReceipt(filename: string): void {
  const file = receiptFile(filename);
  if (file.exists) file.delete();
}

export function importReceipt(uri: string): string {
  if (!/^(file|content):\/\//.test(uri)) throw new ReceiptError('importFailed');
  let filename: string | undefined;
  try {
    const source = new File(uri);
    if (!source.exists) throw new ReceiptError('missing');
    checkReceiptSize(source.size);
    const handle = source.open(FileMode.ReadOnly);
    let extension: ReturnType<typeof receiptExtension>;
    try {
      extension = receiptExtension(handle.readBytes(12));
    } finally {
      handle.close();
    }
    const target = destination(extension);
    filename = target.filename;
    source.copySync(target.file);
    if (!target.file.exists || target.file.size !== source.size)
      throw new ReceiptError('saveFailed');
    return filename;
  } catch (error) {
    if (filename) discardReceipt(filename);
    if (error instanceof ReceiptError) throw error;
    throw new ReceiptError('saveFailed');
  }
}

export function exportReceipt(filename: string): string {
  try {
    const file = receiptFile(filename);
    if (!file.exists) throw new ReceiptError('missing');
    checkReceiptSize(file.size);
    const base64 = file.base64Sync();
    receiptExtension(base64Header(base64));
    return base64;
  } catch (error) {
    if (error instanceof ReceiptError && error.code === 'tooLarge') throw error;
    throw new ReceiptError('missing');
  }
}

export function stageReceipts(receipts: PortableReceipt[]) {
  const staged: { transaction_id: number; filename: string }[] = [];
  try {
    for (const receipt of receipts) {
      const size = base64Size(receipt.base64);
      const target = destination(receiptExtension(base64Header(receipt.base64)));
      staged.push({ transaction_id: receipt.transactionId, filename: target.filename });
      target.file.create();
      target.file.write(receipt.base64, { encoding: 'base64' });
      if (target.file.size !== size) throw new ReceiptError('saveFailed');
    }
    return staged;
  } catch (error) {
    for (const row of staged) discardReceipt(row.filename);
    if (error instanceof ReceiptError) throw error;
    throw new ReceiptError('saveFailed');
  }
}

// Called only before UI initialization or after restore, never while Undo owns deleted files.
export function sweepReceiptFiles(referenced: Set<string>): void {
  try {
    const folder = directory();
    if (!folder.exists) return;
    for (const file of folder.list()) {
      if (file instanceof File && validName.test(file.name) && !referenced.has(file.name))
        file.delete();
    }
  } catch {
    throw new ReceiptError('cleanupFailed');
  }
}
