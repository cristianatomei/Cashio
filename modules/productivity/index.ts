import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type ProductivityModule = {
  update(summary: string, month: string, privateMode: boolean): void;
};

export const Productivity =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<ProductivityModule>('CashioProductivity')
    : null;
