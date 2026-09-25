export const colors = {
  primary: '#7C3AED',
  primaryPressed: '#5B21B6',
  primarySoft: '#F3E8FF',
  purpleLight: '#A78BFA',
  background: '#F8F5FF',
  surface: '#FFFFFF',
  surfaceMuted: '#FBF0FF',
  text: '#21152F',
  textMuted: '#6B6480',
  border: '#E2D9F3',
  success: '#2ECF73',
  warning: '#F5A524',
  error: '#EF5B5B',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  page: 16,
} as const;

export const radii = {
  micro: 12,
  control: 16,
  card: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: '800' as const },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '800' as const },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '700' as const },
} as const;
