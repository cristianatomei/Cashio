import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function usePlanningTime() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);
  return now;
}
