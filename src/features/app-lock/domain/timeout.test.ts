import { shouldLockAfterBackground } from './timeout';

describe('shouldLockAfterBackground', () => {
  it('does not lock when disabled', () => {
    expect(shouldLockAfterBackground(false, 60_000, 0)).toBe(false);
  });

  it('locks immediately when timeout is zero', () => {
    expect(shouldLockAfterBackground(true, 0, 0)).toBe(true);
  });

  it('waits until the configured timeout has elapsed', () => {
    expect(shouldLockAfterBackground(true, 59_999, 1)).toBe(false);
    expect(shouldLockAfterBackground(true, 60_000, 1)).toBe(true);
  });

  it('locks defensively for invalid or backwards elapsed times', () => {
    expect(shouldLockAfterBackground(true, -1, 5)).toBe(true);
    expect(shouldLockAfterBackground(true, Number.NaN, 5)).toBe(true);
    expect(shouldLockAfterBackground(true, 1, Number.NaN)).toBe(true);
  });
});
