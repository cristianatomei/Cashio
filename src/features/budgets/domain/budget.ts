import { addMonths, startOfMonth } from '@/core/utils/dates';

export type BudgetProjection = {
  id: number;
  categoryId: number | null;
  groupId: number | null;
  amountMinor: number;
  currency: string;
  rollover: boolean;
  createdAt: number;
};

export type BudgetTransaction = {
  categoryId: number | null;
  type: string;
  status: string;
  amountMinor: number;
  currency: string;
  occurredAt: number;
  allocations?: { categoryId: number | null; amountMinor: number }[];
};

export type BudgetUsage = BudgetProjection & {
  spentMinor: number;
  carriedMinor: number;
  limitMinor: number;
  progress: number;
};

function spendInRange(
  budget: BudgetProjection,
  transactions: readonly BudgetTransaction[],
  categoryGroups: ReadonlyMap<number, number>,
  from: number,
  to: number,
): number {
  return transactions.reduce((total, transaction) => {
    if (
      transaction.type !== 'expense' ||
      transaction.status !== 'confirmed' ||
      transaction.currency !== budget.currency ||
      transaction.occurredAt < from ||
      transaction.occurredAt >= to ||
      transaction.categoryId === null
    ) {
      return total;
    }

    const allocations =
      transaction.allocations && transaction.allocations.length > 0
        ? transaction.allocations
        : [{ categoryId: transaction.categoryId, amountMinor: transaction.amountMinor }];
    return (
      total +
      allocations.reduce((spent, allocation) => {
        if (allocation.categoryId === null) return spent;
        const matches =
          budget.categoryId !== null
            ? allocation.categoryId === budget.categoryId
            : categoryGroups.get(allocation.categoryId) === budget.groupId;
        return spent + (matches ? allocation.amountMinor : 0);
      }, 0)
    );
  }, 0);
}

export function calculateBudgetUsage(
  budget: BudgetProjection,
  transactions: readonly BudgetTransaction[],
  categoryGroups: ReadonlyMap<number, number>,
  monthFrom: number,
): BudgetUsage {
  const monthTo = addMonths(monthFrom, 1);
  const spentMinor = spendInRange(budget, transactions, categoryGroups, monthFrom, monthTo);
  let carriedMinor = 0;

  if (budget.rollover) {
    let cursor = Math.max(budget.createdAt, startOfMonth(budget.createdAt));
    while (addMonths(startOfMonth(cursor), 1) <= monthFrom) {
      const next = addMonths(startOfMonth(cursor), 1);
      const previousSpend = spendInRange(budget, transactions, categoryGroups, cursor, next);
      carriedMinor = Math.max(0, carriedMinor + budget.amountMinor - previousSpend);
      cursor = next;
    }
  }

  const limitMinor = budget.amountMinor + carriedMinor;
  return {
    ...budget,
    spentMinor,
    carriedMinor,
    limitMinor,
    progress: limitMinor > 0 ? spentMinor / limitMinor : 0,
  };
}

export function crossedBudgetThresholds(
  usage: BudgetUsage,
  alreadyNotified: readonly number[],
): number[] {
  if (usage.limitMinor <= 0) return [];
  return [80, 100].filter(
    (threshold) =>
      usage.spentMinor * 100 >= usage.limitMinor * threshold &&
      !alreadyNotified.includes(threshold),
  );
}
