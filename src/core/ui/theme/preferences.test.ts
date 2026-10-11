import { darkColors, lightColors } from './palette';
import { parseThemePreference, resolveThemeScheme } from './preferences';

describe('theme preference', () => {
  it('defaults to the system theme only when no preference was saved', () => {
    expect(parseThemePreference(undefined)).toBe('system');
    for (const value of ['system', 'light', 'dark']) {
      expect(parseThemePreference(value)).toBe(value);
    }
    expect(() => parseThemePreference('invalid')).toThrow('Invalid saved theme');
  });

  it('follows system changes and handles an unavailable system scheme', () => {
    expect(resolveThemeScheme('system', 'dark')).toBe('dark');
    expect(resolveThemeScheme('system', 'light')).toBe('light');
    expect(resolveThemeScheme('system', null)).toBe('light');
  });

  it('keeps an explicit preference independent of the system', () => {
    expect(resolveThemeScheme('light', 'dark')).toBe('light');
    expect(resolveThemeScheme('dark', 'light')).toBe('dark');
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('teal theme contrast', () => {
  it.each([lightColors, darkColors])('keeps primary button text at WCAG AA contrast', (colors) => {
    const values = [luminance(colors.primary), luminance(colors.onPrimary)];
    const contrast = (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});
