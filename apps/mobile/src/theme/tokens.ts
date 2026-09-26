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
  borderStrong: '#D1C4E9',
  success: '#2ECF73',
  successSoft: '#EAFBF1',
  warning: '#F5A524',
  warningSoft: '#FFF6DF',
  error: '#EF5B5B',
  errorSoft: '#FFF0F0',
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  page: 16,
} as const;

export const radii = {
  micro: 12,
  control: 14,
  card: 24,
  hero: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 38, fontFamily: fonts.extraBold },
  h1: { fontSize: 26, lineHeight: 34, fontFamily: fonts.extraBold },
  h2: { fontSize: 21, lineHeight: 29, fontFamily: fonts.bold },
  h3: { fontSize: 18, lineHeight: 25, fontFamily: fonts.bold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.medium },
  bodyRegular: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
  bodySmall: { fontSize: 13, lineHeight: 19, fontFamily: fonts.medium },
  label: { fontSize: 14, lineHeight: 19, fontFamily: fonts.bold },
  metadata: { fontSize: 12, lineHeight: 17, fontFamily: fonts.semibold },
} as const;
