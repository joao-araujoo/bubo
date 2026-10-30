// Bubo design tokens, copied value for value from apps/mobile/src/theme (colors.ts, layout.ts,
// typography.ts). The film never invents a colour: anything else here says where it comes from.

export const C = {
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
  secondaryRim: '#D1C4E9',
  green: '#2ECF73',
  greenRim: '#1EA858',
  greenSoft: '#E3F9EC',
  greenInk: '#0B7A3B',
  amber: '#F5A524',
  gold: '#FFC53D',
  goldRim: '#D99A00',
  goldSoft: '#FFF4D6',
  orange: '#FF8A3D',
  orangeSoft: '#FFEBDD',
  night: '#140D1F',
  nightSurface: '#1E1530',
  purpleOnDark: '#C4B5FD',
  purpleInk: '#6E3ACA',
  purpleNight: '#3B1680',
  // bookPalette
  paper: '#F7F1E6',
  paperEdge: '#DCD2BF',
  // Sampled from the closed book the official `main` pose holds (rgb 44, 11, 79).
  bookCloth: '#2C0B4F',
};

/** App points → master pixels. 390 pt wide phone → 1080 px. */
export const PT = 1080 / 390;

export const radii = { sm: 8, md: 12, input: 14, lg: 16, card: 24, pill: 999 };
export const sizes = { rim: 5, cardRim: 4, borderWidth: 2, ctaHeight: 56, touchTarget: 48 };

export const FONT = 'Jakarta';
export const SERIF = 'Literata';

/** Type scale (points) from typography.ts. */
export const type = {
  display: { weight: 800, size: 30, line: 38, track: -0.6 },
  heading: { weight: 800, size: 24, line: 32, track: -0.48 },
  title: { weight: 700, size: 20, line: 28, track: -0.2 },
  titleSm: { weight: 700, size: 18, line: 24, track: 0 },
  bodyLg: { weight: 500, size: 17, line: 26, track: -0.17 },
  body: { weight: 500, size: 15, line: 22, track: 0 },
  bodyStrong: { weight: 600, size: 15, line: 22, track: 0 },
  bodySm: { weight: 500, size: 13, line: 18, track: 0 },
  labelLg: { weight: 800, size: 16, line: 20, track: 0.32 },
  label: { weight: 700, size: 14, line: 18, track: 0.14 },
  caption: { weight: 700, size: 11, line: 14, track: 0.44, upper: true },
};

export const W = 1080;
export const H = 1920;
export const FPS = 60;
