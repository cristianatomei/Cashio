import type { TransactionType } from '@/core/domain/transaction';

import { extractAmount } from './amount';
import { normalizeMerchant } from './normalize';

export type NotificationInput = {
  /** Name of the app that sent it (e.g. "ING"); used to ignore titles that are just the bank. */
  sourceName: string;
  title: string | null;
  body: string;
};

export type ParsedNotification = {
  type: TransactionType;
  amountMinor: number;
  currency: string;
  merchantRaw: string | null;
  transferToCash?: boolean;
  transferDirection?: 'incoming' | 'outgoing';
};

const TRANSFER_WORDS = [
  'transfer',
  'transferul',
  'transfer catre',
  'transfer intre',
  'retragere',
  'atm',
  'conturile tale',
  'contul tau',
  'between your accounts',
  'own account',
];
const CASH_WITHDRAWAL_WORDS = ['retragere', 'retragere numerar', 'atm', 'cash withdrawal'];
const TRANSFER_INCOMING_WORDS = [
  'transfer primit',
  'transfer primita',
  'transfer received',
  'received transfer',
  'incoming transfer',
];
const TRANSFER_OUTGOING_WORDS = [
  'transfer catre',
  'transfer trimis',
  'transfer sent',
  'sent transfer',
  'outgoing transfer',
  'transfer initiat',
  'transfer initiated',
];
const INCOME_WORDS = [
  'incasare',
  'incasat',
  'ai primit',
  'primit',
  'creditat',
  'salariu',
  'rambursare',
  'received',
  'refund',
  'top up',
  'topup',
];
const DECLINED_WORDS = [
  'nu ai fonduri suficiente',
  'fonduri insuficiente',
  'insufficient funds',
  'was declined',
  'declined',
  'refuzata',
  'respinsa',
  'nu a fost autorizata',
];

function containsWord(haystack: string, word: string): boolean {
  return ` ${haystack} `.includes(` ${word} `);
}

function detectType(normalizedText: string): TransactionType {
  if (TRANSFER_WORDS.some((word) => containsWord(normalizedText, word))) return 'transfer';
  if (INCOME_WORDS.some((word) => containsWord(normalizedText, word))) return 'income';
  return 'expense';
}

function detectTransferDirection(normalizedText: string): 'incoming' | 'outgoing' | undefined {
  if (TRANSFER_INCOMING_WORDS.some((word) => containsWord(normalizedText, word))) {
    return 'incoming';
  }
  if (TRANSFER_OUTGOING_WORDS.some((word) => containsWord(normalizedText, word))) {
    return 'outgoing';
  }
  return undefined;
}

// Stops at the first word that usually introduces card details; keeps dots inside names ("S.R.L").
const MERCHANT_PATTERN =
  /\b(?:la|de la|at|to|from|merchant:?)\s+([^\n,;:()*]+?)(?=\s+(?:cu|pe|din|on|with|card|ref|data|in|\u00een)\b|[,;:()*\n]|\.(?!\S)|$)/i;

function extractMerchant(text: string, title: string | null, sourceName: string): string | null {
  const fromBody = MERCHANT_PATTERN.exec(text)?.[1]?.trim();
  if (fromBody) return fromBody;

  const trimmedTitle = title?.trim();
  if (trimmedTitle && normalizeMerchant(trimmedTitle) !== normalizeMerchant(sourceName)) {
    return trimmedTitle;
  }
  return null;
}

/** Turns a bank notification into a structured payment; null when it carries no amount. */
export function parseNotification({
  sourceName,
  title,
  body,
}: NotificationInput): ParsedNotification | null {
  const text = [title, body].filter(Boolean).join('\n');
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (DECLINED_WORDS.some((word) => containsWord(normalized, word))) return null;

  const amount = extractAmount(text);
  if (!amount) return null;
  const type = detectType(normalized);
  const transferDirection = type === 'transfer' ? detectTransferDirection(normalized) : undefined;
  const transferToCash =
    type === 'transfer' && CASH_WITHDRAWAL_WORDS.some((word) => containsWord(normalized, word));

  return {
    type,
    ...amount,
    merchantRaw: type === 'transfer' ? null : extractMerchant(body, title, sourceName),
    ...(transferToCash ? { transferToCash: true } : {}),
    ...(transferDirection ? { transferDirection } : {}),
  };
}
