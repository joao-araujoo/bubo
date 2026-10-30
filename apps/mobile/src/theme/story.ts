import { palette } from './colors';
import { fontFamily } from './typography';

/** Editorial sharing surfaces stay consistent across light and dark app preferences. */
export const storyThemes = {
  paper: {
    background: '#F4EFE7',
    ink: palette.ink,
    muted: '#756B80',
    accent: palette.purple,
    decoration: '#E2D4F2',
    contrast: palette.white,
  },
  night: {
    background: '#20152E',
    ink: '#F5EDFF',
    muted: '#C5B4D6',
    accent: '#D8BEFF',
    decoration: '#382449',
    contrast: palette.ink,
  },
  violet: {
    background: '#6A32CE',
    ink: '#FFF9EF',
    muted: '#E5D6FF',
    accent: '#E9E88C',
    decoration: '#7E47DF',
    contrast: palette.ink,
  },
} as const;

export type StoryStyle = keyof typeof storyThemes;

/** 9:16 art coordinates. Essential content stays between 84 and 556 (252–1668 export px). */
export const storyLayout = {
  width: 360,
  height: 640,
  exportWidth: 1080,
  exportHeight: 1920,
  gutter: 30,
  safeTop: 84,
  safeBottom: 84,
  logoHeight: 16,
} as const;

export const storyType = {
  eyebrow: { fontFamily: fontFamily.bold, fontSize: 9, lineHeight: 14, letterSpacing: 2 },
  title: { fontFamily: fontFamily.extrabold, fontSize: 38, lineHeight: 43, letterSpacing: -1.6 },
  bookTitle: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.6 },
  number: { fontFamily: fontFamily.extrabold, fontSize: 92, lineHeight: 102, letterSpacing: -6 },
  metric: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 37, letterSpacing: -1 },
  body: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, letterSpacing: 0 },
  small: { fontFamily: fontFamily.medium, fontSize: 9, lineHeight: 14, letterSpacing: 0 },
} as const;
