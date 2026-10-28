import { canArchiveAccount, isOnboardingCompleted } from './onboarding';

describe('onboarding preferences', () => {
  it('only considers the persisted completion flag complete when set to 1', () => {
    expect(isOnboardingCompleted('1')).toBe(true);
    expect(isOnboardingCompleted(undefined)).toBe(false);
    expect(isOnboardingCompleted('0')).toBe(false);
  });

  it('keeps at least one account active', () => {
    expect(canArchiveAccount(1)).toBe(false);
    expect(canArchiveAccount(2)).toBe(true);
  });
});
