import { ACCOUNT_ICONS, CATEGORY_ICONS } from './icons';

const glyphs: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json');

describe('icon pickers', () => {
  it('only offer icons that exist in MaterialCommunityIcons', () => {
    const missing = [...CATEGORY_ICONS, ...ACCOUNT_ICONS].filter((name) => !(name in glyphs));
    expect(missing).toEqual([]);
  });

  it('have no duplicates', () => {
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
  });
});
