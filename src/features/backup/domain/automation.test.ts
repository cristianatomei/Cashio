import {
  BACKUP_DAY_MS,
  backupAgeDays,
  backupFilesToDelete,
  isBackupDue,
  isBackupStale,
} from './automation';

describe('backup scheduling', () => {
  it('runs immediately for a new schedule and follows daily or weekly intervals', () => {
    const now = 20 * BACKUP_DAY_MS;
    expect(isBackupDue(null, 'daily', now)).toBe(true);
    expect(isBackupDue(now - BACKUP_DAY_MS + 1, 'daily', now)).toBe(false);
    expect(isBackupDue(now - BACKUP_DAY_MS, 'daily', now)).toBe(true);
    expect(isBackupDue(now - 7 * BACKUP_DAY_MS + 1, 'weekly', now)).toBe(false);
    expect(isBackupDue(now - 7 * BACKUP_DAY_MS, 'weekly', now)).toBe(true);
  });

  it('reports whole-day age and considers missing or over-14-day backups stale', () => {
    expect(backupAgeDays(null, 10)).toBeNull();
    expect(backupAgeDays(10, 10 + 3 * BACKUP_DAY_MS + 1)).toBe(3);
    expect(isBackupStale(null, 10)).toBe(true);
    expect(isBackupStale(10, 10 + 14 * BACKUP_DAY_MS)).toBe(false);
    expect(isBackupStale(10, 10 + 15 * BACKUP_DAY_MS)).toBe(true);
  });
});

describe('backup retention', () => {
  it('keeps the newest backups and ignores unrelated or malformed files', () => {
    expect(
      backupFilesToDelete(
        [
          'cashio-backup-100.json',
          'notes.json',
          'cashio-backup-invalid.json',
          'cashio-backup-200.json',
          'cashio-backup-300.json',
        ],
        2,
      ),
    ).toEqual(['cashio-backup-100.json']);
  });

  it('keeps at least one backup even when retention is invalid or zero', () => {
    expect(backupFilesToDelete(['cashio-backup-1.json', 'cashio-backup-2.json'], 0)).toEqual([
      'cashio-backup-1.json',
    ]);
    expect(backupFilesToDelete(['cashio-backup-1.json', 'cashio-backup-2.json'], Number.NaN)).toEqual(
      [],
    );
  });
});
