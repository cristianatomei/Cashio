import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { reportCsv, reportHtml, type MonthlyReport, type ReportLabels } from '../domain/report';

export class ReportExportError extends Error {
  constructor(public readonly reason: 'unsupported' | 'unavailable' | 'failed') {
    super(reason);
  }
}

/** Files stay on-device until the user chooses a destination in the system share sheet. */
export async function exportMonthlyReport(
  format: 'pdf' | 'csv',
  report: MonthlyReport,
  labels: ReportLabels,
  locale: string,
): Promise<void> {
  if (Platform.OS === 'web') throw new ReportExportError('unsupported');
  if (!(await Sharing.isAvailableAsync())) throw new ReportExportError('unavailable');
  if (!FileSystem.cacheDirectory) throw new ReportExportError('unavailable');
  let uri: string | undefined;
  try {
    if (format === 'pdf') {
      // Older installed builds can still open Stats and export CSV without the new native module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Print: typeof import('expo-print') = require('expo-print');
      const file = await Print.printToFileAsync({ html: reportHtml(report, labels, locale) });
      uri = file.uri;
    } else {
      uri = `${FileSystem.cacheDirectory}cashio-${report.month}-${report.currency}-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(uri, reportCsv(report, labels));
    }
    await Sharing.shareAsync(uri, {
      mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
      UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
      dialogTitle: labels.title,
    });
  } catch {
    throw new ReportExportError('failed');
  } finally {
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}
