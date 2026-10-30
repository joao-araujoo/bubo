import { type TextStyle } from 'react-native';

/**
 * Nunito (ADR-043). Custom fonts do not synthesise weights on Android, so each weight is its own
 * family (names = TTF file names, see assets/fonts). Plus Jakarta Sans stays on disk only for the
 * native widgets, which copy it from assets/fonts.
 */
export const fontFamily = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

/**
 * Accent faces used only as effects in the reading flow (ADR-044): handwriting on the recall card
 * and the typewriter rows of the reading receipt. Never for interface text.
 */
export const accentFontFamily = {
  hand: 'Caveat_500Medium',
  mono: 'IBMPlexMono_400Regular',
  monoBold: 'IBMPlexMono_700Bold',
} as const;

export const fontSources = {
  [fontFamily.regular]: require('../../assets/fonts/Nunito_400Regular.ttf'),
  [fontFamily.medium]: require('../../assets/fonts/Nunito_500Medium.ttf'),
  [fontFamily.semibold]: require('../../assets/fonts/Nunito_600SemiBold.ttf'),
  [fontFamily.bold]: require('../../assets/fonts/Nunito_700Bold.ttf'),
  [fontFamily.extrabold]: require('../../assets/fonts/Nunito_800ExtraBold.ttf'),
  [fontFamily.black]: require('../../assets/fonts/Nunito_900Black.ttf'),
  [accentFontFamily.hand]: require('../../assets/fonts/Caveat_500Medium.ttf'),
  [accentFontFamily.mono]: require('../../assets/fonts/IBMPlexMono_400Regular.ttf'),
  [accentFontFamily.monoBold]: require('../../assets/fonts/IBMPlexMono_700Bold.ttf'),
};

type TypeToken = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'
>;

/** Type scale (mobile), from the Stitch design system. */
export const typography = {
  display: { fontFamily: fontFamily.black, fontSize: 30, lineHeight: 38, letterSpacing: -0.6 },
  /** Tab screen titles (TabHeader), the size of Hoje's greeting; fits two actions + avatar at 360 pt. */
  pageTitle: { fontFamily: fontFamily.black, fontSize: 26, lineHeight: 32, letterSpacing: -0.52 },
  heading: { fontFamily: fontFamily.black, fontSize: 24, lineHeight: 32, letterSpacing: -0.48 },
  title: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  titleSm: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  bodyLg: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 26, letterSpacing: -0.17 },
  body: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodySm: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  /** Secondary metadata lines (dates, counts, page ranges) under a row title. */
  meta: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  labelLg: { fontFamily: fontFamily.extrabold, fontSize: 16, lineHeight: 20, letterSpacing: 0.32 },
  label: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 18, letterSpacing: 0.14 },
  /** Compact labels inside chips, tabs and dense rows. */
  labelSm: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.12 },
  /** Tab bar labels: "Comunidade" fits a 360 pt wide bar without shrinking (ADR-047). */
  tabLabel: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0 },
  caption: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TypeToken>;

export type TypographyVariant = keyof typeof typography;
