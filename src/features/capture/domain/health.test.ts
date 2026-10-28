import {
  DEFAULT_CAPTURE_INACTIVITY_DAYS,
  getCaptureHealth,
  parseCaptureInactivityDays,
} from './health';

const DAY = 86_400_000;

function input(overrides: Partial<Parameters<typeof getCaptureHealth>[0]> = {}) {
  return {
    accessGranted: true,
    accessWasGranted: false,
    lastNotificationAt: null,
    now: 20 * DAY,
    inactivityDays: DEFAULT_CAPTURE_INACTIVITY_DAYS,
    ...overrides,
  };
}

describe('capture health', () => {
  it('does not warn new users with no captured bank notifications', () => {
    expect(getCaptureHealth(input({ accessGranted: false }))).toBeNull();
  });

  it('warns when previously granted notification access is revoked', () => {
    expect(getCaptureHealth(input({ accessGranted: false, accessWasGranted: true }))).toEqual({
      kind: 'permission-lost',
    });
  });

  it('does not warn until the configured inactivity period has elapsed', () => {
    expect(getCaptureHealth(input({ lastNotificationAt: 13 * DAY + 1 }))).toBeNull();
    expect(getCaptureHealth(input({ lastNotificationAt: 13 * DAY }))).toEqual({
      kind: 'inactive',
      days: 7,
    });
  });

  it('does not treat a future notification as inactivity', () => {
    expect(getCaptureHealth(input({ lastNotificationAt: 21 * DAY }))).toBeNull();
  });

  it('uses only supported inactivity periods from settings', () => {
    expect(parseCaptureInactivityDays('14')).toBe(14);
    expect(parseCaptureInactivityDays('2')).toBe(DEFAULT_CAPTURE_INACTIVITY_DAYS);
    expect(parseCaptureInactivityDays(undefined)).toBe(DEFAULT_CAPTURE_INACTIVITY_DAYS);
  });
});
