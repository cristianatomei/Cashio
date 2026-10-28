export const APP_LOCK_TIMEOUT_MINUTES = [0, 1, 5, 15] as const;

export type AppLockTimeoutMinutes = (typeof APP_LOCK_TIMEOUT_MINUTES)[number];

export function shouldLockAfterBackground(
  enabled: boolean,
  elapsedMs: number,
  timeoutMinutes: number,
): boolean {
  if (!enabled) return false;
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(timeoutMinutes)) return true;
  if (elapsedMs < 0 || timeoutMinutes < 0) return true;
  return elapsedMs >= timeoutMinutes * 60_000;
}
