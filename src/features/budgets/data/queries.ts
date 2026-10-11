import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { schema, useDb } from '@/core/db';
import { useTaxonomy } from '@/features/categories';

import { calculateBudgetUsage, type BudgetUsage } from '../domain/budget';

export type BudgetView = BudgetUsage & { name: string };

export function useBudgetViews(monthFrom: number): BudgetView[] {
  const db = useDb();
  const { data: budgets } = useLiveQuery(db.select().from(schema.budgets));
  const { data: transactions } = useLiveQuery(db.select().from(schema.transactions));
  const { data: allocations } = useLiveQuery(db.select().from(schema.transactionAllocations));
  const groups = useTaxonomy({ kind: 'expense', includeArchived: true });

  return useMemo(() => {
    const categoryGroups = new Map(
      groups.flatMap((group) =>
        group.categories.map((category) => [category.id, group.id] as const),
      ),
    );
    const groupNames = new Map(groups.map((group) => [group.id, group.name]));
    const categoryNames = new Map(
      groups.flatMap((group) =>
        group.categories.map((category) => [category.id, category.name] as const),
      ),
    );
    const allocationsByTransaction = new Map<number, typeof allocations>();
    for (const allocation of allocations) {
      allocationsByTransaction.set(allocation.transactionId, [
        ...(allocationsByTransaction.get(allocation.transactionId) ?? []),
        allocation,
      ]);
    }

    return budgets.map((budget) => ({
      ...calculateBudgetUsage(
        {
          id: budget.id,
          categoryId: budget.categoryId,
          groupId: budget.groupId,
          amountMinor: budget.amountMinor,
          currency: budget.currency,
          rollover: budget.rollover,
          createdAt: budget.createdAt,
        },
        transactions.map((transaction) => ({
          ...transaction,
          allocations: allocationsByTransaction.get(transaction.id)?.map((allocation) => ({
            categoryId: allocation.categoryId,
            amountMinor: allocation.amountMinor,
          })),
        })),
        categoryGroups,
        monthFrom,
      ),
      name:
        (budget.categoryId === null ? undefined : categoryNames.get(budget.categoryId)) ??
        (budget.groupId === null ? undefined : groupNames.get(budget.groupId)) ??
        '',
    }));
  }, [budgets, transactions, allocations, groups, monthFrom]);
}
