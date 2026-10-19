import { parseInvestmentAssets } from './assets';

describe('parseInvestmentAssets', () => {
  it('returns an empty list when no assets are stored', () => {
    expect(parseInvestmentAssets(undefined)).toEqual([]);
    expect(parseInvestmentAssets(null)).toEqual([]);
  });

  it('validates and normalizes the asset name', () => {
    expect(
      parseInvestmentAssets(
        JSON.stringify([{ id: '1', name: ' Bitcoin ', symbol: 'BTC', kind: 'crypto' }]),
      ),
    ).toEqual([{ id: '1', name: 'Bitcoin', symbol: 'BTC', kind: 'crypto' }]);
  });

  it('rejects invalid symbols, kinds, and duplicate ids', () => {
    expect(() =>
      parseInvestmentAssets(
        JSON.stringify([{ id: '1', name: 'Bitcoin', symbol: 'bad!', kind: 'crypto' }]),
      ),
    ).toThrow('invalid asset');
    expect(() =>
      parseInvestmentAssets(
        JSON.stringify([{ id: '1', name: 'Bitcoin', symbol: 'BTC', kind: 'fund' }]),
      ),
    ).toThrow('invalid asset');
    expect(() =>
      parseInvestmentAssets(
        JSON.stringify([
          { id: '1', name: 'Bitcoin', symbol: 'BTC', kind: 'crypto' },
          { id: '1', name: 'Ethereum', symbol: 'ETH', kind: 'crypto' },
        ]),
      ),
    ).toThrow('invalid asset');
  });
});
