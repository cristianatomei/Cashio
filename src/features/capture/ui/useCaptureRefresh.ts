import { useCallback } from 'react';

import { useDb } from '@/core/db';
import { currentLanguage } from '@/core/i18n';

import { syncCapture } from '../data/sync';

export function useCaptureRefresh(): () => Promise<void> {
  const db = useDb();
  return useCallback(async () => {
    await syncCapture(db, currentLanguage());
  }, [db]);
}
