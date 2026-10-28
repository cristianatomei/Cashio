import type { AppDb } from '@/core/db';
import * as schema from '@/core/db/schema';
import { saveHomeLoanLink } from './loanLinks';

function fixture({
  loan = { id: 1, currency: 'RON' } as { id: number; currency: string } | null,
  rule = { type: 'expense', currency: 'RON' } as { type: string; currency: string } | null,
  links = [] as { id: number }[],
} = {}) {
  const run = jest.fn();
  const set = jest.fn(() => ({ where: () => ({ run }) }));
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          get: () => (table === schema.loanSchedules ? loan : rule),
          all: () => links,
        }),
      }),
    }),
    update: () => ({ set }),
  };
  const db = {
    transaction: (callback: (transaction: typeof tx) => void) => callback(tx),
  } as unknown as AppDb;
  return { db, run, set };
}

it('persists an explicit one-to-one loan association', () => {
  const { db, set, run } = fixture();
  saveHomeLoanLink(db, 1, 2);
  expect(set).toHaveBeenCalledWith({ recurringId: 2 });
  expect(run).toHaveBeenCalledTimes(1);
});

it('can remove an association without a remaining rule', () => {
  const { db, set } = fixture({ rule: null });
  saveHomeLoanLink(db, 1, null);
  expect(set).toHaveBeenCalledWith({ recurringId: null });
});

it.each([
  { loan: null },
  { rule: null },
  { rule: { type: 'income', currency: 'RON' } },
  { rule: { type: 'expense', currency: 'EUR' } },
  { links: [{ id: 3 }] },
])('rejects invalid or ambiguous associations before writing (%j)', (options) => {
  const { db, run, set } = fixture(options);
  expect(() => saveHomeLoanLink(db, 1, 2)).toThrow();
  expect(set).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});
