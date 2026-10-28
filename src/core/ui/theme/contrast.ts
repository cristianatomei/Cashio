function channels(hex: string): number[] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value;
  return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
}

function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** Match the existing #RRGGBB26 tint against its actual opaque surface. */
export function tintedSurface(color: string, background: string): string {
  const base = channels(background);
  return `#${channels(color)
    .map((channel, index) =>
      Math.round(channel * (0x26 / 255) + base[index] * (1 - 0x26 / 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Keep user hues when readable; never mutate the stored custom color. */
export function contrastingColor(color: string, background: string, minimum = 3): string {
  const opaqueHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  // Named/dynamic native colors cannot be measured here; preserve the caller's API.
  if (!opaqueHex.test(color) || !opaqueHex.test(background)) return color;
  if (contrastRatio(color, background) >= minimum) return color;
  return contrastRatio('#000000', background) > contrastRatio('#FFFFFF', background)
    ? '#000000'
    : '#FFFFFF';
}
