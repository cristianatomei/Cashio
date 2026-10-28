import type { TextStyle } from 'react-native';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const minimumTouchTarget = 48;

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'caption';

export const typography: Record<TextVariant, TextStyle> = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
};
