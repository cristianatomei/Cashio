export const DEFAULT_CAPTURE_INACTIVITY_DAYS = 7;
export const CAPTURE_INACTIVITY_DAY_OPTIONS = [3, 7, 14, 30] as const;

export type CaptureHealthInput = {
  accessGranted: boolean;
  accessWasGranted: boolean;
  lastNotificationAt: number | null;
  now: number;
  inactivityDays: number;
};

export type CaptureHealthStatus =
  { kind: 'permission-lost' } | { kind: 'inactive'; days: number } | null;

export function parseCaptureInactivityDays(value: string | null | undefined): number {
  const days = Number(value);
  return CAPTURE_INACTIVITY_DAY_OPTIONS.includes(
    days as (typeof CAPTURE_INACTIVITY_DAY_OPTIONS)[number],
  )
    ? days
    : DEFAULT_CAPTURE_INACTIVITY_DAYS;
}

export function getCaptureHealth({
  accessGranted,
  accessWasGranted,
  lastNotificationAt,
  now,
  inactivityDays,
}: CaptureHealthInput): CaptureHealthStatus {
  if (!accessGranted && accessWasGranted) return { kind: 'permission-lost' };
  if (lastNotificationAt === null || lastNotificationAt > now) return null;

  const elapsedDays = Math.floor((now - lastNotificationAt) / 86_400_000);
  return elapsedDays >= inactivityDays ? { kind: 'inactive', days: elapsedDays } : null;
}
