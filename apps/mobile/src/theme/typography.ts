import { type TextStyle } from 'react-native';

/**
 * Plus Jakarta Sans. Custom fonts do not synthesise weights on Android, so each weight is its own
 * family (names = TTF file names, see assets/fonts).
 */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const fontSources = {
  [fontFamily.regular]: require('../../assets/fonts/PlusJakartaSans_400Regular.ttf'),
  [fontFamily.medium]: require('../../assets/fonts/PlusJakartaSans_500Medium.ttf'),
  [fontFamily.semibold]: require('../../assets/fonts/PlusJakartaSans_600SemiBold.ttf'),
  [fontFamily.bold]: require('../../assets/fonts/PlusJakartaSans_700Bold.ttf'),
  [fontFamily.extrabold]: require('../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf'),
};

type TypeToken = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'
>;

/** Type scale (mobile), from the Stitch design system. */
export const typography = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 38, letterSpacing: -0.6 },
  heading: { fontFamily: fontFamily.extrabold, fontSize: 24, lineHeight: 32, letterSpacing: -0.48 },
  title: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  titleSm: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  bodyLg: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 26, letterSpacing: -0.17 },
  body: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodySm: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  labelLg: { fontFamily: fontFamily.extrabold, fontSize: 16, lineHeight: 20, letterSpacing: 0.32 },
  label: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 18, letterSpacing: 0.14 },
  caption: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TypeToken>;

export type TypographyVariant = keyof typeof typography;
