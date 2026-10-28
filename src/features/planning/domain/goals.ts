export type GoalInput = {
  name: string;
  currency: string;
  targetMinor: number;
  currentMinor: number;
};

export function validateGoal(input: GoalInput): void {
  if (
    !input.name.trim() ||
    !/^[A-Z]{3}$/.test(input.currency) ||
    !Number.isSafeInteger(input.targetMinor) ||
    input.targetMinor <= 0 ||
    !Number.isSafeInteger(input.currentMinor) ||
    input.currentMinor < 0
  ) {
    throw new Error('Invalid savings goal.');
  }
}

export function goalProgress(input: GoalInput) {
  validateGoal(input);
  return {
    ratio: Math.min(input.currentMinor / input.targetMinor, 1),
    percent: Math.min(Math.floor((input.currentMinor / input.targetMinor) * 100), 100),
    remainingMinor: Math.max(input.targetMinor - input.currentMinor, 0),
    complete: input.currentMinor >= input.targetMinor,
  };
}

export type ValuationInput = {
  assetId: string;
  amountMinor: number;
  currency: string;
  valuedAt: number;
};

export function validateValuation(input: ValuationInput): void {
  if (
    !input.assetId.trim() ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor < 0 ||
    !/^[A-Z]{3}$/.test(input.currency) ||
    !Number.isSafeInteger(input.valuedAt) ||
    input.valuedAt < 0 ||
    input.valuedAt > 8640000000000000
  ) {
    throw new Error('Invalid investment valuation.');
  }
}
