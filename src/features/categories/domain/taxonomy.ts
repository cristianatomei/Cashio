export type Group = {
  id: number;
  name: string;
  kind: 'expense' | 'income';
  color: string;
  icon: string;
  sortOrder: number;
  archived: boolean;
};

export type Category = {
  id: number;
  groupId: number;
  name: string;
  icon: string;
  sortOrder: number;
  archived: boolean;
};

export type GroupWithCategories = Group & { categories: Category[] };

/** Attaches categories to their group, ordered, optionally skipping archived rows. */
export function buildTaxonomy(
  groups: readonly Group[],
  categories: readonly Category[],
  { includeArchived = false }: { includeArchived?: boolean } = {},
): GroupWithCategories[] {
  const bySort = <T extends { sortOrder: number; id: number }>(a: T, b: T) =>
    a.sortOrder - b.sortOrder || a.id - b.id;

  return [...groups]
    .filter((g) => includeArchived || !g.archived)
    .sort(bySort)
    .map((group) => ({
      ...group,
      categories: categories
        .filter((c) => c.groupId === group.id && (includeArchived || !c.archived))
        .sort(bySort),
    }));
}
