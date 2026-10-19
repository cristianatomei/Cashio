import { normalizeText } from '@/features/parsing';

import type { InvestmentAsset } from './assets';

export type InvestmentMovement = {
  asset: InvestmentAsset;
  direction: 'up' | 'down';
  changePercent: number | null;
};

const UP_PHRASES = [
  'up',
  'increased',
  'increase',
  'rose',
  'risen',
  'gained',
  'gain',
  'grew',
  'growth',
  'crescut',
  'crestere',
  'urcat',
  'urcare',
  'rise',
];
const DOWN_PHRASES = [
  'down',
  'decreased',
  'decrease',
  'fell',
  'fallen',
  'dropped',
  'drop',
  'declined',
  'decline',
  'scazut',
  'scadere',
  'coborat',
  'coborare',
  'fall',
];

function hasPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${normalizeText(phrase)} `);
}

function detectDirection(text: string): InvestmentMovement['direction'] | null {
  const up = UP_PHRASES.some((phrase) => hasPhrase(text, phrase));
  const down = DOWN_PHRASES.some((phrase) => hasPhrase(text, phrase));
  if (up === down) return null;
  return up ? 'up' : 'down';
}

function mentionsAsset(text: string, asset: InvestmentAsset): boolean {
  return hasPhrase(text, asset.name) || hasPhrase(text, asset.symbol);
}

export function isRevolutPriceMovementNotification(
  sourceName: string,
  title: string | null,
  body: string,
): boolean {
  if (normalizeText(sourceName) !== 'revolut') return false;
  const text = [title, body].filter(Boolean).join(' ');
  const normalized = normalizeText(text);
  return detectDirection(normalized) !== null && /\d+(?:[.,]\d+)?\s*%/.test(text);
}

/** Interprets explicit Revolut price-movement messages for one manually tracked asset. */
export function parseInvestmentNotification(
  sourceName: string,
  title: string | null,
  body: string,
  assets: readonly InvestmentAsset[],
): InvestmentMovement | null {
  if (!isRevolutPriceMovementNotification(sourceName, title, body)) return null;

  const normalized = normalizeText([title, body].filter(Boolean).join(' '));
  const matchingAssets = assets.filter((asset) => mentionsAsset(normalized, asset));
  if (matchingAssets.length !== 1) return null;

  const direction = detectDirection(normalized);
  if (!direction) return null;

  const percentMatch = /([+-]?\d+(?:[.,]\d+)?)\s*%/.exec([title, body].filter(Boolean).join(' '));
  const percentText = percentMatch?.[1];
  const percent = percentText ? Number(percentText.replace(',', '.')) : null;
  if (percent !== null && !Number.isFinite(percent)) return null;
  const explicitlySigned = percentText?.startsWith('+') || percentText?.startsWith('-');
  if (
    explicitlySigned &&
    percent !== null &&
    ((percent < 0 && direction === 'up') || (percent > 0 && direction === 'down'))
  ) {
    return null;
  }

  const asset = matchingAssets[0];
  if (!asset) return null;
  return {
    asset,
    direction,
    changePercent: percent === null ? null : Math.abs(percent),
  };
}
