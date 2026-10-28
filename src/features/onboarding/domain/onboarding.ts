export function isOnboardingCompleted(value: string | undefined): boolean {
  return value === '1';
}

export function canArchiveAccount(activeAccountCount: number): boolean {
  return activeAccountCount > 1;
}
