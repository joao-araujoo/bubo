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
  transparent: palette.transparent,
};

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
