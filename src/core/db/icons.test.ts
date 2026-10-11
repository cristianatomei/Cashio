import { DEFAULT_ACCOUNTS, DEFAULT_GROUPS } from './defaults';

const glyphs: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json');

describe('default data icons', () => {
  it('only use icons that exist in MaterialCommunityIcons', () => {
    const used = [
      ...DEFAULT_GROUPS.flatMap((g) => [g.icon, ...g.categories.map((c) => c.icon)]),
      ...DEFAULT_ACCOUNTS.map((a) => a.icon),
    ];
    const missing = [...new Set(used)].filter((name) => !(name in glyphs));
    expect(missing).toEqual([]);
  });
});
