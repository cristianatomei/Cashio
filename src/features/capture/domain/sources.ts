export type CaptureSource = {
  packageName: string;
  name: string;
};

// Package names are unverified guesses; check them against the first captured notifications.
export const DEFAULT_CAPTURE_SOURCES: readonly CaptureSource[] = [
  { packageName: 'ro.ing.mobile.banking.android.activity', name: 'ING' },
  { packageName: 'com.revolut.revolut', name: 'Revolut' },
  // `adb shell cmd notification post` is attributed to the shell package; dev builds only,
  // and simulated notifications are treated as ING ones.
  ...(__DEV__ ? [{ packageName: 'com.android.shell', name: 'ING' }] : []),
];
