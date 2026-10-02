/**
 * Colour tokens. The ONLY place in the mobile app where raw colour values may appear
 * (enforced by `npm run audit:repo`). Light values follow the Task 01 brand spec and the Stitch
 * "Tactile Cognitive Gamification" design system; dark values are derived for the same roles.
 */
export const palette = {
  purple: '#7C3AED',
  purpleDeep: '#5B21B6',
  purpleLight: '#A78BFA',
  purpleSoft: '#EDE4FF',
  lavender: '#F8F5FF',
  lavenderMuted: '#FBF0FF',
  white: '#FFFFFF',
  ink: '#21152F',
  inkMuted: '#6B6480',
  line: '#E2D9F3',
  lineSoft: '#E9E3F5',
  green: '#2ECF73',
  greenRim: '#1EA858',
  amber: '#F5A524',
  amberRim: '#C98214',
  red: '#EF5B5B',
  redRim: '#C93F3F',
  redSoft: '#FFEEEE',
  gold: '#FFC53D',
  goldRim: '#D99A00',
  goldSoft: '#FFF4D6',
  orange: '#FF8A3D',
  orangeSoft: '#FFEBDD',
  night: '#140D1F',
  nightSurface: '#1E1530',
  nightSurfaceMuted: '#271C3D',
  nightLine: '#3A2D52',
  nightText: '#F4EEFF',
  nightTextMuted: '#B3A9C9',
  purpleOnDark: '#C4B5FD',
  /** Stitch secondary (#6E3ACA): eyebrows and headings on lavender. */
  purpleInk: '#6E3ACA',
  purpleNight: '#3B1680',
  greenInk: '#0B7A3B',
  greenSoft: '#E3F9EC',
  amberInk: '#9A5B00',
  redInk: '#BA1A1A',
  blue: '#3B82F6',
  blueSoft: '#E6EEFF',
  transparent: 'transparent',
} as const;

export type ColorTokens = {
  primary: string;
  primaryPressed: string;
  primaryRim: string;
  purpleLight: string;
  primarySoft: string;
  onPrimary: string;
  accentText: string;
  bg: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  borderSoft: string;
  secondaryRim: string;
  success: string;
  successRim: string;
  onSuccess: string;
  warning: string;
  warningRim: string;
  error: string;
  errorRim: string;
  errorSoft: string;
  gold: string;
  goldRim: string;
  goldSoft: string;
  orange: string;
  orangeSoft: string;
  scrim: string;
  cardShadow: string;
  /** Uppercase eyebrows and small headings (Stitch secondary). */
  accentDeep: string;
  /** Text/icons on soft green, amber and red pills (readable contrast). */
  successText: string;
  successSoft: string;
  warningText: string;
  errorText: string;
  /** Blue icon backplate (Stitch "Meta semanal", "Páginas lidas"). */
  blue: string;
  blueSoft: string;
  /** Purple hero gradient (club profile, memory index). */
  heroStart: string;
  heroEnd: string;
  /** Decorative circles and muted text on the purple hero. */
  heroGlow: string;
  heroGlowSoft: string;
  onHeroMuted: string;
  /** Top highlight stripe of the 16 pt progress "tube" (DESIGN.md §4). */
  tubeHighlight: string;
  transparent: string;
};

export const lightColors: ColorTokens = {
  primary: palette.purple,
  primaryPressed: palette.purpleDeep,
  primaryRim: palette.purpleDeep,
  purpleLight: palette.purpleLight,
  primarySoft: palette.purpleSoft,
  onPrimary: palette.white,
  accentText: palette.purple,
  bg: palette.lavender,
  surface: palette.white,
  surfaceMuted: palette.lavenderMuted,
  text: palette.ink,
  textMuted: palette.inkMuted,
  border: palette.line,
  borderSoft: palette.lineSoft,
  secondaryRim: '#D1C4E9',
  success: palette.green,
  successRim: palette.greenRim,
  onSuccess: palette.white,
  warning: palette.amber,
  warningRim: palette.amberRim,
  error: palette.red,
  errorRim: palette.redRim,
  errorSoft: palette.redSoft,
  gold: palette.gold,
  goldRim: palette.goldRim,
  goldSoft: palette.goldSoft,
  orange: palette.orange,
  orangeSoft: palette.orangeSoft,
  scrim: 'rgba(33, 21, 47, 0.5)',
  cardShadow: palette.line,
  accentDeep: palette.purpleInk,
  successText: palette.greenInk,
  successSoft: palette.greenSoft,
  warningText: palette.amberInk,
  errorText: palette.redInk,
  blue: palette.blue,
  blueSoft: palette.blueSoft,
  heroStart: palette.purple,
  heroEnd: palette.purpleNight,
  heroGlow: 'rgba(255, 255, 255, 0.10)',
  heroGlowSoft: 'rgba(255, 255, 255, 0.06)',
  onHeroMuted: 'rgba(255, 255, 255, 0.82)',
  tubeHighlight: 'rgba(255, 255, 255, 0.35)',
  transparent: palette.transparent,
};

export const darkColors: ColorTokens = {
  primary: palette.purple,
  primaryPressed: palette.purpleDeep,
  primaryRim: '#3B1680',
  purpleLight: palette.purpleLight,
  primarySoft: '#2E1F4D',
  onPrimary: palette.white,
  accentText: palette.purpleOnDark,
  bg: palette.night,
  surface: palette.nightSurface,
  surfaceMuted: palette.nightSurfaceMuted,
  text: palette.nightText,
  textMuted: palette.nightTextMuted,
  border: palette.nightLine,
  borderSoft: '#31254A',
  secondaryRim: '#2A1F40',
  success: palette.green,
  successRim: palette.greenRim,
  onSuccess: palette.white,
  warning: palette.amber,
  warningRim: palette.amberRim,
  error: '#FF7A7A',
  errorRim: palette.redRim,
  errorSoft: '#3A1E27',
  gold: palette.gold,
  goldRim: palette.goldRim,
  goldSoft: '#3A2E12',
  orange: palette.orange,
  orangeSoft: '#3B2415',
  scrim: 'rgba(0, 0, 0, 0.6)',
  cardShadow: '#0C0714',
  accentDeep: palette.purpleOnDark,
  successText: '#6EE7A0',
  successSoft: '#133A25',
  warningText: '#FFC96B',
  errorText: '#FF9A9A',
  blue: '#7FB0FF',
  blueSoft: '#1B2A4A',
  heroStart: palette.purpleDeep,
  heroEnd: palette.purpleNight,
  heroGlow: 'rgba(255, 255, 255, 0.08)',
  heroGlowSoft: 'rgba(255, 255, 255, 0.05)',
  onHeroMuted: 'rgba(255, 255, 255, 0.78)',
  tubeHighlight: 'rgba(255, 255, 255, 0.22)',
  transparent: palette.transparent,
};

/** QR codes stay dark-on-light in both themes: many scanners fail on inverted codes. */
export const qrPalette = { dark: palette.ink, light: palette.white } as const;

/**
 * Home-screen widget scenes (ADR-026), after the Duolingo-style streak widgets: a saturated
 * vertical gradient where the purple Bubo pops, a big streak number and a short caption.
 * The native plugin generates Android/iOS colours from this table; never duplicate it.
 * `pill`/`pillText` style calendar runs and pending week days; `deco` tints the decorations.
 */
export type WidgetScenePalette = {
  top: string;
  bottom: string;
  text: string;
  muted: string;
  number: string;
  pill: string;
  pillText: string;
  deco: string;
  decoration: 'sparkles' | 'stars' | 'confetti' | 'embers' | 'hearts' | 'none';
};

/** Lit flame (activity today) and the red "!" badge when the streak is at risk. Unlit flames use the scene's `number` colour. */
export const widgetFlame = { outer: '#FF9F1C', inner: '#FFD84D', alert: '#E5243B' } as const;

export const widgetScenes = {
  /** Daytime nudge: read a little today. */
  sky: {
    top: '#6CCBFF',
    bottom: '#2F7BF5',
    text: '#FFFFFF',
    muted: '#E3F2FF',
    number: '#FFFFFF',
    pill: '#8FC4FF',
    pillText: '#FFFFFF',
    deco: '#FFFFFF',
    decoration: 'sparkles',
  },
  /** Recall cards are waiting. */
  teal: {
    top: '#36DCC4',
    bottom: '#0E8A8E',
    text: '#FFFFFF',
    muted: '#D8FFF8',
    number: '#FFFFFF',
    pill: '#5FD3C6',
    pillText: '#FFFFFF',
    deco: '#FFFFFF',
    decoration: 'sparkles',
  },
  /** Evening: the streak is at risk. */
  sunset: {
    top: '#FFA94D',
    bottom: '#F0443E',
    text: '#FFFFFF',
    muted: '#FFE6D6',
    number: '#FFFFFF',
    pill: '#FFA27A',
    pillText: '#FFFFFF',
    deco: '#FFE08A',
    decoration: 'embers',
  },
  /** Last hours of the day with the streak still at risk. */
  alarm: {
    top: '#D4264F',
    bottom: '#4C0820',
    text: '#FFFFFF',
    muted: '#FFD0DC',
    number: '#FFFFFF',
    pill: '#8E1838',
    pillText: '#FFD0DC',
    deco: '#FF8A3D',
    decoration: 'embers',
  },
  /** Bubo sleeps: night sky with moon and stars. */
  night: {
    top: '#2B3576',
    bottom: '#0D1236',
    text: '#FFFFFF',
    muted: '#C3CCEA',
    number: '#FFC53D',
    pill: '#3A4590',
    pillText: '#C3CCEA',
    deco: '#FFFFFF',
    decoration: 'stars',
  },
  /** Today's reading is done. */
  gold: {
    top: '#FFE07A',
    bottom: '#FFA81F',
    text: '#5A3300',
    muted: '#7A4A00',
    number: '#7A3E00',
    pill: '#FFF0BF',
    pillText: '#B86400',
    deco: '#FFFFFF',
    decoration: 'confetti',
  },
  /** Weekly goal met; also the calendar when today is done. */
  mint: {
    top: '#EFFCF3',
    bottom: '#C6F0D6',
    text: '#0B5E33',
    muted: '#2F7A50',
    number: '#FF8A3D',
    pill: '#FFE3BF',
    pillText: '#E8780E',
    deco: '#FF8A3D',
    decoration: 'confetti',
  },
  /** First steps: no streak yet. */
  candy: {
    top: '#FF8CC3',
    bottom: '#E3418C',
    text: '#FFFFFF',
    muted: '#FFE0EE',
    number: '#FFFFFF',
    pill: '#FF9CCB',
    pillText: '#FFFFFF',
    deco: '#FFFFFF',
    decoration: 'hearts',
  },
  /** Calendar when today is still pending. */
  periwinkle: {
    top: '#8C9BFF',
    bottom: '#5B5BEF',
    text: '#FFFFFF',
    muted: '#E5E9FF',
    number: '#FFFFFF',
    pill: '#A9B4FF',
    pillText: '#FFE08A',
    deco: '#FFFFFF',
    decoration: 'sparkles',
  },
  /** Data is stale: open the app to refresh. */
  slate: {
    top: '#4B5168',
    bottom: '#22253A',
    text: '#FFFFFF',
    muted: '#C9CCDA',
    number: '#FFFFFF',
    pill: '#5A6079',
    pillText: '#C9CCDA',
    deco: '#C9CCDA',
    decoration: 'none',
  },
  /** Signed out or never synced. */
  lavender: {
    top: '#F6F1FF',
    bottom: '#DCCBFF',
    text: '#3B1680',
    muted: '#6B6480',
    number: '#7C3AED',
    pill: '#EDE4FF',
    pillText: '#7C3AED',
    deco: '#A78BFA',
    decoration: 'sparkles',
  },
} as const satisfies Record<string, WidgetScenePalette>;

/**
 * Typographic fallback covers (BookCover), after the Stitch "Descobrir" covers: a deep, saturated
 * face with the author in caps on top and the title in heavy type. Same in light and dark.
 */
export type CoverPalette = {
  face: string;
  spine: string;
  text: string;
  muted: string;
  accent: string;
};

export const coverPalettes: readonly CoverPalette[] = [
  { face: '#D9601A', spine: '#9A3A0C', text: '#FFFFFF', muted: '#FFE1CC', accent: '#FFC53D' },
  { face: '#1F2230', spine: '#0F111A', text: '#FFFFFF', muted: '#B9BCCB', accent: '#A78BFA' },
  { face: '#6D28D9', spine: '#4C1D95', text: '#FFFFFF', muted: '#E3D6FF', accent: '#FFC53D' },
  { face: '#1E2A55', spine: '#111A38', text: '#FFFFFF', muted: '#C3CCEA', accent: '#7DD3FC' },
  { face: '#8E1B24', spine: '#5E0F16', text: '#FFFFFF', muted: '#F6C9CD', accent: '#FFC53D' },
  { face: '#0F6B4F', spine: '#08432F', text: '#FFFFFF', muted: '#C4EEDD', accent: '#FFE08A' },
];
