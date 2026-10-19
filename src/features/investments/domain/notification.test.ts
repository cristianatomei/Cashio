import type { InvestmentAsset } from './assets';
import { isRevolutPriceMovementNotification, parseInvestmentNotification } from './notification';

describe('Revolut investment notifications', () => {
  const assets: InvestmentAsset[] = [
    { id: '1', name: 'Bitcoin', symbol: 'BTC', kind: 'crypto' },
    { id: '2', name: 'Ethereum', symbol: 'ETH', kind: 'crypto' },
  ];

  it('recognizes a tracked asset increase with a percentage', () => {
    expect(parseInvestmentNotification('Revolut', 'BTC is up 2.4%', '', assets)).toEqual({
      asset: assets[0],
      direction: 'up',
      changePercent: 2.4,
    });
  });

  it('recognizes Romanian decreases without requiring a percent', () => {
    expect(
      parseInvestmentNotification('Revolut', null, 'Bitcoin a scăzut cu 3%', assets),
    ).toMatchObject({ direction: 'down', changePercent: 3 });
  });

  it('does not infer movement for other sources, untracked assets, or ambiguous assets', () => {
    expect(parseInvestmentNotification('ING', 'BTC is up 2%', '', assets)).toBeNull();
    expect(parseInvestmentNotification('Revolut', 'DOGE is up 2%', '', assets)).toBeNull();
    expect(
      parseInvestmentNotification('Revolut', 'BTC and ETH both rose 2%', '', assets),
    ).toBeNull();
  });

  it('rejects signed percentages that contradict the movement wording', () => {
    expect(parseInvestmentNotification('Revolut', 'BTC is up -2%', '', assets)).toBeNull();
    expect(parseInvestmentNotification('Revolut', 'BTC is down +2%', '', assets)).toBeNull();
  });

  it('recognizes an explicit price movement even when the asset is not tracked', () => {
    expect(isRevolutPriceMovementNotification('Revolut', 'DOGE is down 2%', '')).toBe(true);
    expect(isRevolutPriceMovementNotification('Revolut', 'DOGE transaction: 2%', '')).toBe(false);
  });
});
