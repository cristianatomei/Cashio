import { asc, eq, isNull } from 'drizzle-orm';

import { schema, type AppDb, type Language } from '@/core/db';
import { DEFAULT_KEYWORD_RULES, normalizeText, parseNotification } from '@/features/parsing';
import { isRevolutPriceMovementNotification } from '@/features/investments/domain/notification';
import { findRecurringMatch, nextDueAfterPayment } from '@/features/recurring';

import { resolveCapture } from '../domain/resolve';
import { DEFAULT_CAPTURE_SOURCES } from '../domain/sources';

/** Turns unprocessed raw notifications into transactions; returns how many were created. */
export function processRawNotifications(db: AppDb, language: Language): number {
  const pending = db
    .select()
    .from(schema.rawNotifications)
    .where(isNull(schema.rawNotifications.processedAt))
    .orderBy(asc(schema.rawNotifications.postedAt))
    .all();
  if (pending.length === 0) return 0;

  const accounts = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.archived, false))
    .all();
  const merchants = db.select().from(schema.merchants).all();
  const aliases = db.select().from(schema.merchantAliases).all();
  const categories = db.select().from(schema.categories).all();
  const recurringRules = db.select().from(schema.recurringRules).all();

  const categoryIdsByName = new Map(categories.map((c) => [normalizeText(c.name), c.id]));
  const cashAccountId = accounts.find((a) => a.type === 'cash')?.id ?? null;
  const now = Date.now();
  let created = 0;

  db.transaction((tx) => {
    for (const raw of pending) {
      const sourceName =
        DEFAULT_CAPTURE_SOURCES.find((s) => s.packageName === raw.packageName)?.name ?? '';
      const account =
        accounts.find((a) => normalizeText(a.name) === normalizeText(sourceName)) ??
        accounts.find((a) => a.type === 'bank');
      const isInvestmentMovement = isRevolutPriceMovementNotification(
        sourceName,
        raw.title,
        raw.body,
      );
      const parsed = isInvestmentMovement
        ? null
        : parseNotification({ sourceName, title: raw.title, body: raw.body });
      if (parsed) {
        const captured = resolveCapture(parsed, {
          language,
          text: `${raw.title ?? ''} ${raw.body}`,
          postedAt: raw.postedAt,
          accountId: account?.id ?? null,
          cashAccountId,
          ownAccounts: accounts
            .filter((candidate) => candidate.type === 'bank' && candidate.iban !== null)
            .map(({ id, iban }) => ({ id, iban })),
          aliases,
          merchants,
          categoryIdsByName,
          rules: DEFAULT_KEYWORD_RULES,
        });
        const recurringMatch =
          captured.status === 'confirmed' && captured.accountId !== null
            ? findRecurringMatch({ ...captured, accountId: captured.accountId }, recurringRules)
            : null;
        const inserted = tx
          .insert(schema.transactions)
          .values({
            ...captured,
            source: 'notification',
            rawNotificationId: raw.id,
            recurringId: recurringMatch?.id ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .returning({ id: schema.transactions.id })
          .all();
        created += inserted.length;
        if (inserted.length > 0 && recurringMatch) {
          const nextDue = nextDueAfterPayment(recurringMatch, captured.occurredAt);
          tx.update(schema.recurringRules)
            .set({ nextDue })
            .where(eq(schema.recurringRules.id, recurringMatch.id))
            .run();
          recurringMatch.nextDue = nextDue;
        }
      }

      tx.update(schema.rawNotifications)
        .set({ processedAt: now })
        .where(eq(schema.rawNotifications.id, raw.id))
        .run();
    }
  });

  return created;
}
