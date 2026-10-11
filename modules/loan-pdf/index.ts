import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

type LoanPdfNativeModule = {
  extractText(uri: string): Promise<string>;
};

export async function extractLoanPdfText(uri: string): Promise<string> {
  if (Platform.OS !== 'android') {
    throw new Error('ING loan schedule PDF import is currently available on Android only.');
  }
  return requireNativeModule<LoanPdfNativeModule>('LoanPdf').extractText(uri);
}
