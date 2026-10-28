import * as FileSystem from 'expo-file-system/legacy';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { createCashioBackup, serializeCashioBackup } from './backup';
import {
  backupFilesToDelete,
  isBackupDue,
  isBackupFrequency,
  type BackupFrequency,
} from '../domain/automation';

const FOLDER_KEY = 'backup_folder_uri';
const FREQUENCY_KEY = 'backup_frequency';
const RETENTION_KEY = 'backup_retention';
const LAST_BACKUP_KEY = 'backup_last_at';
const DEFAULT_RETENTION = 10;
let backupInProgress = false;

type Setting = { value: string };

async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  return (
    (await db.getFirstAsync<Setting>('SELECT value FROM app_settings WHERE key = ?', [key]))?.value ??
    null
  );
}

export async function saveBackupSetting(
  db: SQLiteDatabase,
  key: typeof FOLDER_KEY | typeof FREQUENCY_KEY | typeof RETENTION_KEY | typeof LAST_BACKUP_KEY,
  value: string,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export async function chooseBackupFolder(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  return result.granted ? result.directoryUri : null;
}

function decodeFileName(uri: string): string {
  const finalPart = uri.slice(uri.lastIndexOf('/') + 1);
  let decoded = finalPart;
  try {
    decoded = decodeURIComponent(finalPart);
  } catch {
    // Keep the original URI segment if the provider returns malformed escaping.
  }
  return decoded.slice(decoded.lastIndexOf('/') + 1);
}

async function writeBackup(directoryUri: string, name: string, json: string): Promise<void> {
  if (Platform.OS === 'android') {
    const uri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      name.replace(/\.json$/, ''),
      'application/json',
    );
    await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, json);
    return;
  }

  await FileSystem.writeAsStringAsync(`${directoryUri}${name}`, json);
}

async function pruneBackups(directoryUri: string, retention: number): Promise<void> {
  const uris =
    Platform.OS === 'android'
      ? await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri)
      : await FileSystem.readDirectoryAsync(directoryUri);
  const entries = uris.map((uri) => ({
    uri: Platform.OS === 'android' ? uri : `${directoryUri}${uri}`,
    name: Platform.OS === 'android' ? decodeFileName(uri) : uri,
  }));
  const removedNames = backupFilesToDelete(
    entries.map(({ name }) => name),
    retention,
  );
  await Promise.all(
    entries
      .filter(({ name }) => removedNames.includes(name))
      .map(({ uri }) =>
        Platform.OS === 'android'
          ? FileSystem.StorageAccessFramework.deleteAsync(uri)
          : FileSystem.deleteAsync(uri, { idempotent: true }),
      ),
  );
}

export async function runScheduledBackup(
  db: SQLiteDatabase,
  now = Date.now(),
): Promise<boolean> {
  if (backupInProgress) return false;
  backupInProgress = true;
  try {
    const [frequencyValue, lastValue, retentionValue, folderUri] = await Promise.all([
      getSetting(db, FREQUENCY_KEY),
      getSetting(db, LAST_BACKUP_KEY),
      getSetting(db, RETENTION_KEY),
      getSetting(db, FOLDER_KEY),
    ]);
    const frequency: BackupFrequency = isBackupFrequency(frequencyValue)
      ? frequencyValue
      : 'daily';
    const lastBackupAt = lastValue === null || lastValue.trim() === '' ? null : Number(lastValue);
    if (
      (lastBackupAt !== null && !Number.isSafeInteger(lastBackupAt)) ||
      !isBackupDue(lastBackupAt, frequency, now)
    ) {
      return false;
    }

    const directoryUri =
      Platform.OS === 'android' ? folderUri : FileSystem.documentDirectory;
    if (!directoryUri) return false;

    const retention = retentionValue === null ? DEFAULT_RETENTION : Number(retentionValue);
    const backup = await createCashioBackup(db);
    const fileName = `cashio-backup-${backup.createdAt}.json`;
    await writeBackup(directoryUri, fileName, serializeCashioBackup(backup));
    try {
      await pruneBackups(directoryUri, retention);
    } catch (error) {
      console.error('Failed to apply Cashio backup retention', error);
    }
    await saveBackupSetting(db, LAST_BACKUP_KEY, String(backup.createdAt));
    return true;
  } finally {
    backupInProgress = false;
  }
}

export const backupSettingKeys = {
  folder: FOLDER_KEY,
  frequency: FREQUENCY_KEY,
  retention: RETENTION_KEY,
  lastAt: LAST_BACKUP_KEY,
} as const;
