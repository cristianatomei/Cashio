import { en } from './en';
import { ro } from './ro';

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translations', () => {
  it('have the same keys in Romanian and English', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(ro).sort());
  });

  it('have no empty strings', () => {
    for (const locale of [ro, en]) {
      const values = JSON.stringify(locale).match(/"[^"]*"(?=[,}])/g) ?? [];
      expect(values).not.toContain('""');
    }
  });
});
