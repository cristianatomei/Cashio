import { DEFAULT_ACCOUNTS, DEFAULT_GROUPS } from './defaults';

describe('default data', () => {
  it('has Romanian and English names for everything', () => {
    const names = [
      ...DEFAULT_ACCOUNTS.map((a) => a.name),
      ...DEFAULT_GROUPS.map((g) => g.name),
      ...DEFAULT_GROUPS.flatMap((g) => g.categories.map((c) => c.name)),
    ];
    for (const name of names) {
      expect(name.ro.trim()).not.toBe('');
      expect(name.en.trim()).not.toBe('');
    }
  });

  it('has unique group names and unique category names within a group', () => {
    const groupNames = DEFAULT_GROUPS.map((g) => g.name.ro);
    expect(new Set(groupNames).size).toBe(groupNames.length);
    for (const group of DEFAULT_GROUPS) {
      const categoryNames = group.categories.map((c) => c.name.ro);
      expect(new Set(categoryNames).size).toBe(categoryNames.length);
    }
  });

  it('has at least one income group and one cash account', () => {
    expect(DEFAULT_GROUPS.some((g) => g.kind === 'income')).toBe(true);
    expect(DEFAULT_ACCOUNTS.some((a) => a.type === 'cash')).toBe(true);
  });

  it('uses valid hex colors', () => {
    for (const color of [...DEFAULT_GROUPS.map((g) => g.color), ...DEFAULT_ACCOUNTS.map((a) => a.color)]) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
