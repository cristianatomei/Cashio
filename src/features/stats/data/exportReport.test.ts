import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { en } from '@/core/i18n/locales/en';
import { buildMonthlyReport, type ReportLabels } from '../domain/report';
import { exportMonthlyReport } from './exportReport';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file:///cache/month.pdf' }),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const labels: ReportLabels = {
  ...en.insights,
  title: en.insights.titleReport,
  income: 'Income',
  expense: 'Expense',
  balance: 'Balance',
};
const report = buildMonthlyReport([], new Date(2026, 9, 20).getTime(), 'RON');
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
});
afterEach(() => {
  Platform.OS = originalOS;
});

describe('on-device report export', () => {
  it('creates and shares a real PDF with the system share sheet and removes its cache copy', async () => {
    await exportMonthlyReport('pdf', report, labels, 'en-GB');
    expect(Print.printToFileAsync).toHaveBeenCalledWith({
      html: expect.stringContaining('<!doctype html>'),
    });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/month.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/month.pdf', {
      idempotent: true,
    });
  });

  it('writes UTF-8 CSV without involving the print module', async () => {
    await exportMonthlyReport('csv', report, labels, 'ro-RO');
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/cashio-2026-10-RON-\d+\.csv$/),
      expect.stringContaining('\uFEFF'),
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('.csv'),
      expect.objectContaining({ mimeType: 'text/csv' }),
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
  });

  it('cleans up on share failure and surfaces an actionable failure', async () => {
    jest.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error('disk/share error'));
    await expect(exportMonthlyReport('csv', report, labels, 'ro-RO')).rejects.toMatchObject({
      reason: 'failed',
    });
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
  });

  it('surfaces PDF generation failure without attempting to share a nonexistent file', async () => {
    jest.mocked(Print.printToFileAsync).mockRejectedValueOnce(new Error('missing native module'));
    await expect(exportMonthlyReport('pdf', report, labels, 'ro-RO')).rejects.toMatchObject({
      reason: 'failed',
    });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('does not silently fail on web or when sharing is unavailable', async () => {
    Platform.OS = 'web';
    await expect(exportMonthlyReport('pdf', report, labels, 'en-GB')).rejects.toMatchObject({
      reason: 'unsupported',
    });
    Platform.OS = 'ios';
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
    await expect(exportMonthlyReport('csv', report, labels, 'en-GB')).rejects.toMatchObject({
      reason: 'unavailable',
    });
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
  });
});
