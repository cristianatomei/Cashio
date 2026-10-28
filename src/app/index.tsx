import { Redirect } from 'expo-router';

import { useDb } from '@/core/db';
import { loadOnboardingCompleted } from '@/features/onboarding';

export default function Index() {
  const db = useDb();
  return <Redirect href={loadOnboardingCompleted(db) ? '/home' : '/onboarding'} />;
}
