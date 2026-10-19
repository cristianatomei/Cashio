import type { Language } from '@/core/db';
import type { TransactionStatus, TransactionType } from '@/core/domain/transaction';
import {
  classifyText,
  normalizeMerchant,
  normalizeText,
  type KeywordRule,
  type ParsedNotification,
} from '@/features/parsing';
import { normalizeIban } from '@/features/accounts/domain/iban';

import { matchAlias, type MerchantAlias } from './aliases';

export type CaptureContext = {
  language: Language;
  /** Full notification text, used for keyword rules. */
  text: string;
  postedAt: number;
  accountId: number | null;
  /** Destination of ATM withdrawals; null when no cash account exists. */
  cashAccountId: number | null;
  /** User-owned bank accounts; an IBAN match can link a transfer to another account. */
  ownAccounts: readonly { id: number; iban: string | null }[];
  aliases: readonly MerchantAlias[];
  merchants: readonly { id: number; defaultCategoryId: number | null }[];
  /** Category ids keyed by normalizeText(name). */
  categoryIdsByName: ReadonlyMap<string, number>;
  rules: readonly KeywordRule[];
};

export type CapturedTransaction = {
  type: TransactionType;
  accountId: number | null;
  transferAccountId: number | null;
  amountMinor: number;
  currency: string;
  merchantId: number | null;
  merchantRaw: string | null;
  categoryId: number | null;
  status: TransactionStatus;
  occurredAt: number;
  dedupeHash: string;
};

/** Same payment seen twice within a minute (e.g. an updated notification) collapses to one hash. */
export function dedupeHash(parts: {
  accountId: number | null;
  type: TransactionType;
  amountMinor: number;
  postedAt: number;
  merchantRaw: string | null;
}): string {
  const minute = Math.floor(parts.postedAt / 60000);
  const merchant = normalizeMerchant(parts.merchantRaw ?? '');
  return `${parts.accountId}|${parts.type}|${parts.amountMinor}|${minute}|${merchant}`;
}

/**
 * Decides what a parsed notification becomes. It is confirmed right away only when the merchant
 * and category are both known (or it is an ATM transfer); everything else waits in "To classify".
 */
export function resolveCapture(
  parsed: ParsedNotification,
  ctx: CaptureContext,
): CapturedTransaction {
  const rule = classifyText(ctx.text, ctx.rules);
  let type = parsed.type === 'transfer' ? 'transfer' : (rule?.type ?? parsed.type);
  let accountId = ctx.accountId;
  let transferAccountId = type === 'transfer' && parsed.transferToCash ? ctx.cashAccountId : null;

  if (transferAccountId === null && ctx.accountId !== null) {
    const compactText = ctx.text.replace(/[^a-z0-9]/gi, '').toUpperCase();
    const matches = ctx.ownAccounts.filter(
      (account) =>
        account.id !== ctx.accountId &&
        account.iban !== null &&
        compactText.includes(normalizeIban(account.iban)),
    );
    const matchedAccount = matches.length === 1 ? (matches[0] ?? null) : null;
    const direction =
      parsed.type === 'income'
        ? 'incoming'
        : parsed.type === 'expense'
          ? 'outgoing'
          : parsed.transferDirection;

    if (matchedAccount && direction) {
      type = 'transfer';
      if (direction === 'incoming') {
        accountId = matchedAccount.id;
        transferAccountId = ctx.accountId;
      } else {
        transferAccountId = matchedAccount.id;
      }
    }
  }

  const merchantRaw = type === 'transfer' ? null : parsed.merchantRaw;
  const alias = merchantRaw ? matchAlias(normalizeMerchant(merchantRaw), ctx.aliases) : null;
  const merchantId = alias?.merchantId ?? null;
  const merchantCategory =
    ctx.merchants.find((m) => m.id === merchantId)?.defaultCategoryId ?? null;
  const ruleCategory = rule?.category
    ? (ctx.categoryIdsByName.get(normalizeText(rule.category[ctx.language])) ?? null)
    : null;
  const categoryId = type === 'transfer' ? null : (merchantCategory ?? ruleCategory);

  const complete =
    type === 'transfer'
      ? accountId !== null && transferAccountId !== null && accountId !== transferAccountId
      : categoryId !== null;

  return {
    type,
    accountId,
    transferAccountId,
    amountMinor: parsed.amountMinor,
    currency: parsed.currency,
    merchantId,
    merchantRaw,
    categoryId,
    status: complete ? 'confirmed' : 'draft',
    occurredAt: ctx.postedAt,
    dedupeHash: dedupeHash({
      accountId,
      type,
      amountMinor: parsed.amountMinor,
      postedAt: ctx.postedAt,
      merchantRaw,
    }),
  };
}
