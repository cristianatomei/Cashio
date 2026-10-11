import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

export type PendingNotification = {
  id: number;
  packageName: string;
  title: string | null;
  body: string;
  postedAt: number;
};

type NativeNotificationListener = {
  isAccessGranted(): boolean;
  openAccessSettings(): void;
  setAllowedPackages(packages: string[]): void;
  readPending(): Promise<PendingNotification[]>;
  deletePending(ids: number[]): Promise<void>;
};

// Only Android can read other apps' notifications; other platforms get a no-op.
const noop: NativeNotificationListener = {
  isAccessGranted: () => false,
  openAccessSettings: () => {},
  setAllowedPackages: () => {},
  readPending: async () => [],
  deletePending: async () => {},
};

export const NotificationListener: NativeNotificationListener =
  Platform.OS === 'android'
    ? requireNativeModule<NativeNotificationListener>('NotificationListener')
    : noop;
