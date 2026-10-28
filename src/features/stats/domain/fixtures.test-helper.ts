import type { TransactionView } from '@/features/transactions';

export function expense(month: number, overrides: Partial<TransactionView> = {}): TransactionView {
  const category = {
    id: 1,
    name: 'Media',
    icon: 'tv',
    color: '#123456',
    groupId: 2,
    groupName: 'Fun',
  };
  return {
    id: month + 1,
    type: 'expense',
    status: 'confirmed',
    amountMinor: 1000,
    baseAmountMinor: null,
    currency: 'RON',
    occurredAt: new Date(2026, month, 5).getTime(),
    source: 'manual',
    recurringId: null,
    note: null,
    account: null,
    transferAccount: null,
    category,
    allocations: [{ amountMinor: 1000, category }],
    merchant: { id: 1, name: 'Service' },
    merchantRaw: null,
    tags: [],
    ...overrides,
  };
}
