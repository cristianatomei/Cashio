export type BackupFrequency = 'daily' | 'weekly';

export const BACKUP_DAY_MS = 24 * 60 * 60 * 1000;
export const BACKUP_STALE_AFTER_DAYS = 14;

export function isBackupFrequency(value: string | null | undefined): value is BackupFrequency {
  return value === 'daily' || value === 'weekly';
}

export function isBackupDue(
  lastBackupAt: number | null,
  frequency: BackupFrequency,
  now: number,
): boolean {
  if (lastBackupAt === null) return true;
  const interval = frequency === 'daily' ? BACKUP_DAY_MS : BACKUP_DAY_MS * 7;
  return now - lastBackupAt >= interval;
}

export function backupAgeDays(lastBackupAt: number | null, now: number): number | null {
  return lastBackupAt === null ? null : Math.max(0, Math.floor((now - lastBackupAt) / BACKUP_DAY_MS));
}

export function isBackupStale(lastBackupAt: number | null, now: number): boolean {
  const ageDays = backupAgeDays(lastBackupAt, now);
  return ageDays === null || ageDays > BACKUP_STALE_AFTER_DAYS;
}

export function backupFilesToDelete(fileNames: readonly string[], retention: number): string[] {
  const safeRetention = Number.isSafeInteger(retention) ? Math.max(1, retention) : 10;
  const backups = fileNames.flatMap((name) => {
    const match = /^cashio-backup-(\d+)\.json$/.exec(name);
    if (!match) return [];
    const timestamp = Number(match[1]);
    return Number.isSafeInteger(timestamp) ? [{ name, timestamp }] : [];
  });
  backups.sort((left, right) => left.timestamp - right.timestamp || left.name.localeCompare(right.name));
  return backups.slice(0, Math.max(0, backups.length - safeRetention)).map(({ name }) => name);
}
