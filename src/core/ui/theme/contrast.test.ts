import { ACCOUNT_ICONS, CATEGORY_ICONS } from '@/features/categories/domain/icons';
import { en } from '@/core/i18n/locales/en';
import { ro } from '@/core/i18n/locales/ro';

import { contrastingColor, contrastRatio, tintedSurface } from './contrast';
import { darkColors, lightColors, swatchColors } from './palette';

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s theme contrast (WCAG relative luminance)', (_scheme, colors) => {
  const surfaces = [
    colors.background,
    colors.surface,
    colors.surfaceElevated,
    colors.primarySoft,
    colors.tabBar,
  ];

  it.each([
    'text',
    'textSecondary',
    'textMuted',
    'primary',
    'income',
    'expense',
    'warning',
  ] as const)(
    '%s has at least 4.5:1 on every standard text surface, including small captions',
    (token) => {
      for (const surface of surfaces) {
        expect(contrastRatio(colors[token], surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('keeps normal button text at 4.5:1 on primary and danger fills', () => {
    for (const fill of [colors.primary, colors.expense]) {
      expect(contrastRatio(colors.onPrimary, fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('distinguishes control boundaries at 3:1 from all standard surfaces', () => {
    for (const surface of surfaces) {
      expect(contrastRatio(colors.controlBorder, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps selected chip text and boundaries readable for every offered custom color', () => {
    for (const color of swatchColors) {
      for (const surface of surfaces) {
        const tint = tintedSurface(color, surface);
        expect(contrastRatio(colors.text, tint)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.textSecondary, tint)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('keeps category glyphs readable without rewriting custom colors', () => {
    for (const color of swatchColors) {
      const foreground =
        contrastingColor(color, tintedSurface(color, colors.surface)) === color &&
        contrastingColor(color, tintedSurface(color, colors.background)) === color &&
        contrastingColor(color, tintedSurface(color, colors.surfaceElevated)) === color &&
        contrastingColor(color, tintedSurface(color, colors.primarySoft)) === color
          ? color
          : colors.text;
      for (const surface of surfaces) {
        expect(contrastRatio(foreground, tintedSurface(color, surface))).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('keeps progress fills at 3:1, including custom hues', () => {
    for (const color of [colors.primary, colors.expense, ...swatchColors]) {
      expect(
        contrastRatio(contrastingColor(color, colors.primarySoft), colors.primarySoft),
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

it('uses a 4.5:1 checkmark for every swatch in either theme', () => {
  for (const color of swatchColors) {
    expect(contrastRatio(contrastingColor('#FFFFFF', color, 4.5), color)).toBeGreaterThanOrEqual(
      4.5,
    );
  }
});

it('matches published black/white contrast and composites the actual 0x26 alpha', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
  expect(contrastRatio('#fff', '#000')).toBe(21);
  expect(contrastRatio('#145DA0', '#145DA0')).toBe(1);
  expect(tintedSurface('#FFFFFF', '#000000')).toBe('#262626');
  expect(contrastingColor('red', '#FFFFFF')).toBe('red');
  expect(contrastingColor('rgba(10, 20, 30, 0.8)', '#FFFFFF')).toBe('rgba(10, 20, 30, 0.8)');
});

it.each([en, ro])('names every offered color and icon in both supported languages', (locale) => {
  for (const color of swatchColors) {
    expect(locale.accessibility.colors).toHaveProperty(color.slice(1));
  }
  for (const icon of [...CATEGORY_ICONS, ...ACCOUNT_ICONS]) {
    expect(locale.accessibility.icons).toHaveProperty(icon);
  }
});
