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
 * Home-screen widgets (ADR-029, after the owner's Duolingo references): one clean, near-white
 * surface for every widget, a single accent per widget and Bubo carrying the emotion. The native
 * plugin generates Android/iOS tokens from this table; never duplicate it.
 */
export const widgetPalette = {
  /** Widget surface: near-white with a whisper of lavender, slightly deeper at the bottom. */
  surface: '#FDFCFF',
  surfaceEnd: '#F4EFFF',
  /** League widget wash (lavender, as in the reference). */
  leagueTop: '#F8F5FF',
  leagueBottom: '#EAE2FF',
  ink: palette.ink,
  /** Captions ("Você está indo bem!"). */
  muted: '#8A839F',
  /** Weekday letters, future days. */
  faint: '#B4AEC4',
  /** Empty day circles and the progress track. */
  empty: '#ECE8F4',
  divider: '#E6E0F2',
  /** Streak accent: the flame, checks and the streak number. */
  flame: '#FF9416',
  flameGlow: '#FFD24D',
  flameText: '#F07000',
  /** Calendar runs of consecutive active days. */
  streakSoft: '#FFE8C7',
  streakText: '#D26400',
  /** Streak protection (ice): protected days and the protection chip. */
  freeze: '#2DA8E0',
  freezeSoft: '#DCF2FC',
  freezeText: '#127FB3',
  purple: palette.purple,
  purpleInk: palette.purpleInk,
  purpleSoft: palette.purpleSoft,
  purpleLight: palette.purpleLight,
  /** League podium steps and avatars. */
  podium: '#DCD0FF',
  podiumTop: '#E9E2FF',
  avatar: '#F1EBFF',
  /** League badge gem. */
  gem: '#8ADCFF',
  /** Rank going up (green is used for nothing else). */
  up: '#1E9E50',
  /** Time left in the league week. */
  time: '#F07000',
  /** Red "!" when the streak is at risk tonight. */
  alert: '#E5243B',
  white: palette.white,
  /** Soft shadow under the book cover (alpha applied natively). */
  shadow: '#3B1680',
} as const;

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
