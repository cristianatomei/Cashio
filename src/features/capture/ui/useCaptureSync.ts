import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/core/db';
import { currentLanguage } from '@/core/i18n';

import { syncCapture } from '../data/sync';

/** Keeps captured notifications flowing into transactions while the app runs. */
export function useCaptureSync(): void {
  const db = useDb();

  useEffect(() => {
    const run = () => {
      syncCapture(db, currentLanguage()).catch((error: unknown) => {
        console.error('Capture sync failed', error);
      });
    };
    const initial = setTimeout(run, 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => {
      clearTimeout(initial);
      subscription.remove();
    };
  }, [db]);
}
