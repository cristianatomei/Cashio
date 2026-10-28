import { Buffer } from 'buffer';

// In-memory, synthetic-only implementation of the SDK57 methods exercised by receipts.
export const files = new Map<string, Buffer>();
const folders = new Set<string>();
export const failures = { copy: false, write: false, delete: false, read: false };
export const Paths = { document: 'file:///private/documents', cache: 'file:///private/cache' };
export const FileMode = { ReadOnly: 'r' };
const path = (parts: (string | { uri: string })[]) =>
  parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');

export function resetFiles() {
  files.clear();
  folders.clear();
  for (const key of Object.keys(failures) as (keyof typeof failures)[]) failures[key] = false;
}

export class File {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = path(parts);
  }
  get name() {
    return this.uri.slice(this.uri.lastIndexOf('/') + 1);
  }
  get exists() {
    return files.has(this.uri);
  }
  get size() {
    return files.get(this.uri)?.length ?? 0;
  }
  create() {
    if (files.has(this.uri)) throw new Error('Already exists');
    files.set(this.uri, Buffer.alloc(0));
  }
  write(value: string, options?: { encoding?: string }) {
    if (failures.write) throw new Error('Disk full');
    files.set(this.uri, Buffer.from(value, options?.encoding === 'base64' ? 'base64' : 'utf8'));
  }
  copySync(target: File) {
    if (failures.copy) throw new Error('Copy failed');
    files.set(target.uri, Buffer.from(files.get(this.uri)!));
  }
  base64Sync() {
    if (failures.read) throw new Error('Read failed');
    return files.get(this.uri)!.toString('base64');
  }
  open() {
    if (failures.read) throw new Error('Read failed');
    return {
      readBytes: (length: number) => new Uint8Array(files.get(this.uri)!.subarray(0, length)),
      close: () => undefined,
    };
  }
  delete() {
    if (failures.delete) throw new Error('Delete failed');
    files.delete(this.uri);
  }
}

export class Directory {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = path(parts);
  }
  get exists() {
    return folders.has(this.uri);
  }
  create() {
    folders.add(this.uri);
  }
  list() {
    return [...files.keys()]
      .filter((uri) => uri.startsWith(`${this.uri}/`))
      .map((uri) => new File(uri));
  }
}

export const syntheticJpeg = Buffer.from([255, 216, 255, 224, 0, 0, 0, 0, 255, 217]);
