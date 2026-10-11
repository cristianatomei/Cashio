import { buildTaxonomy, type Category, type Group } from './taxonomy';

const group = (id: number, sortOrder: number, archived = false): Group => ({
  id,
  name: `g${id}`,
  kind: 'expense',
  color: '#fff',
  icon: 'tag-outline',
  sortOrder,
  archived,
});
const category = (id: number, groupId: number, sortOrder: number, archived = false): Category => ({
  id,
  groupId,
  name: `c${id}`,
  icon: 'tag-outline',
  sortOrder,
  archived,
});

describe('buildTaxonomy', () => {
  const groups = [group(1, 2), group(2, 1), group(3, 3, true)];
  const categories = [category(10, 1, 2), category(11, 1, 1), category(12, 2, 1, true)];

  it('orders groups and categories and hides archived rows by default', () => {
    const result = buildTaxonomy(groups, categories);
    expect(result.map((g) => g.id)).toEqual([2, 1]);
    expect(result[0].categories).toEqual([]);
    expect(result[1].categories.map((c) => c.id)).toEqual([11, 10]);
  });

  it('can include archived rows', () => {
    const result = buildTaxonomy(groups, categories, { includeArchived: true });
    expect(result.map((g) => g.id)).toEqual([2, 1, 3]);
    expect(result[0].categories.map((c) => c.id)).toEqual([12]);
  });
});
