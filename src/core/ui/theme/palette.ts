export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  income: string;
  expense: string;
  warning: string;
  tabBar: string;
  overlay: string;
};

export const lightColors: ThemeColors = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E5E7EF',
  text: '#10131A',
  textSecondary: '#4B5263',
  textMuted: '#8A91A3',
  primary: '#145DA0',
  primarySoft: '#E3F0FC',
  onPrimary: '#FFFFFF',
  income: '#0FA99A',
  expense: '#F0525A',
  warning: '#F59E0B',
  tabBar: '#FFFFFF',
  overlay: 'rgba(16, 19, 26, 0.45)',
};

export const darkColors: ThemeColors = {
  background: '#0E1116',
  surface: '#171B22',
  surfaceElevated: '#1F2430',
  border: '#2A3040',
  text: '#F3F5FA',
  textSecondary: '#B4BBCB',
  textMuted: '#7E869A',
  primary: '#60A5FA',
  primarySoft: '#152D47',
  onPrimary: '#08192B',
  income: '#2DD4BF',
  expense: '#FF6B6B',
  warning: '#FFB84D',
  tabBar: '#12161D',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

// Colors offered when the user customizes an account, group or tag.
export const swatchColors = [
  '#145DA0',
  '#4C9AFF',
  '#36C2CE',
  '#2DD4BF',
  '#4ADE80',
  '#A3E635',
  '#FFB84D',
  '#FF9F43',
  '#FF6B6B',
  '#FF5C8A',
  '#D97706',
  '#64748B',
  '#94A3B8',
  '#FF6200',
  '#0666EB',
  '#8B5E3C',
] as const;

// Distinct hues for charts when a series has no color of its own.
export const chartPalette = [
  '#145DA0',
  '#2DD4BF',
  '#FF6B6B',
  '#FFB84D',
  '#4C9AFF',
  '#FF5C8A',
  '#36C2CE',
  '#64748B',
  '#FF9F43',
  '#94A3B8',
] as const;
