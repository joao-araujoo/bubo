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
  /** Book pages (ADR-042): veil over the blurred cover backdrop and its fade into `bg`. */
  /**
   * Hoje's book stage (ADR-043): the blurred cover is darkened by `stageVeil`; chips and the
   * secondary button are glass on it; the progress track is a translucent tube. These read on any
   * cover colour, in both schemes.
   */
  stageVeil: string;
  stageGlass: string;
  stageGlassBorder: string;
  stageTrack: string;
  /** The stage's primary button: a white face with deep-violet text whatever the scheme. */
  stageButton: string;
  onStageButton: string;
  stageButtonRim: string;
  /** Coloured day tiles (orange streak, green review): rim, ink and faint marks. */
  orangeRim: string;
  onAccentTile: string;
  tileFaint: string;
  backdropVeil: string;
  bgClear: string;
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
  stageVeil: 'rgba(20, 13, 31, 0.42)',
  stageGlass: 'rgba(255, 255, 255, 0.16)',
  stageGlassBorder: 'rgba(255, 255, 255, 0.26)',
  stageTrack: 'rgba(255, 255, 255, 0.24)',
  stageButton: palette.white,
  onStageButton: palette.purpleDeep,
  stageButtonRim: 'rgba(20, 13, 31, 0.38)',
  orangeRim: '#C2410C',
  onAccentTile: palette.ink,
  tileFaint: 'rgba(255, 255, 255, 0.42)',
  backdropVeil: 'rgba(248, 245, 255, 0.45)',
  bgClear: 'rgba(248, 245, 255, 0)',
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
  stageVeil: 'rgba(10, 6, 16, 0.5)',
  stageGlass: 'rgba(255, 255, 255, 0.14)',
  stageGlassBorder: 'rgba(255, 255, 255, 0.22)',
  stageTrack: 'rgba(255, 255, 255, 0.2)',
  stageButton: palette.white,
  onStageButton: palette.purpleDeep,
  stageButtonRim: 'rgba(0, 0, 0, 0.45)',
  orangeRim: '#9A3412',
  onAccentTile: palette.ink,
  tileFaint: 'rgba(255, 255, 255, 0.4)',
  backdropVeil: 'rgba(20, 13, 31, 0.5)',
  bgClear: 'rgba(20, 13, 31, 0)',
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

/**
 * The physical book object (Book3D in the book detail): paper edges, spine shading and the
 * soft shadow it rests on. A book is the same object in light and dark mode, so the paper tones
 * are fixed; only the shadow is picked per scheme by the component.
 */
export const bookPalette = {
  /** Fore-edge paper, slightly warm. */
  paper: '#F7F1E6',
  /** Darker paper between page stripes. */
  paperEdge: '#DCD2BF',
  /** Hinge groove along the spine side of the cover (dark, light, fade). */
  hingeDark: 'rgba(20, 10, 30, 0.34)',
  hingeLight: 'rgba(255, 255, 255, 0.16)',
  hingeFade: 'rgba(20, 10, 30, 0.06)',
  /** Diagonal gloss across the cover. */
  gloss: 'rgba(255, 255, 255, 0.18)',
  /** Shadow colour under the book (opacity applied by the component). */
  shadowLight: '#3B1680',
  shadowDark: '#000000',
  transparent: 'transparent',
} as const;

/**
 * The reading flow (ADR-044): the night of the focus timer and of the streak screen, the paper of
 * the recall card and the printed reading receipt. They are scenes and objects, the same in light
 * and dark mode, so the values are fixed.
 */
export const readingPalette = {
  night: '#1B1326',
  nightEnd: '#2A1748',
  nightSheet: '#241A33',
  nightText: palette.nightText,
  nightMuted: palette.nightTextMuted,
  glass: 'rgba(255, 255, 255, 0.07)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  sheetHandle: 'rgba(255, 255, 255, 0.18)',
  /** Quiet actions on the night (links, "Tentar lembrar"). */
  purpleOnNight: palette.purpleOnDark,
  scrim: 'rgba(0, 0, 0, 0.5)',
  /** Warm lamp glow in the corner (stacked, so each layer is faint). */
  lamp: 'rgba(255, 197, 61, 0.06)',
  gold: palette.gold,
  goldRim: palette.goldRim,
  onGold: '#3D2600',
  /** One leaf per focused minute: read, being read, still ahead. */
  leafNow: 'rgba(255, 197, 61, 0.55)',
  leafAhead: 'rgba(255, 255, 255, 0.1)',
  /** The bookmark ribbon that grows with the session. */
  ribbon: palette.purpleLight,
  ribbonShade: 'rgba(0, 0, 0, 0.15)',
  flame: palette.orange,
  flameWash: 'rgba(255, 138, 61, 0.14)',
  flameBorder: 'rgba(255, 138, 61, 0.35)',
  flameText: '#FFD2B3',
  /** Streak calendar: run band, protected day, inactive and future days. */
  run: 'rgba(255, 138, 61, 0.28)',
  freeze: '#2DA8E0',
  freezeWash: 'rgba(45, 168, 224, 0.14)',
  freezeIcon: '#7FD3F7',
  freezeText: '#BFE9FB',
  dayPast: 'rgba(244, 238, 255, 0.65)',
  dayFuture: 'rgba(244, 238, 255, 0.3)',
  milestoneNext: 'rgba(255, 197, 61, 0.16)',
  star: palette.white,
  /** The recall card: lined paper, red margin, blue handwriting, folder tabs and the stamp. */
  paper: '#FFFDF6',
  paperBorder: palette.lineSoft,
  paperRim: palette.line,
  paperLine: '#DCE4F7',
  paperMargin: '#F4B6B6',
  handInk: '#2B3A67',
  paperInk: palette.ink,
  paperMuted: palette.inkMuted,
  tabAhead: palette.purpleSoft,
  tabDone: palette.greenSoft,
  tabDoneInk: palette.greenInk,
  tabCheck: palette.greenRim,
  stamp: palette.purple,
  stampWash: 'rgba(255, 253, 246, 0.6)',
  bubble: palette.ink,
  onBubble: palette.white,
  /** The receipt: violet backdrop, printer slot, mono rows, gold total. */
  receiptBg: palette.purple,
  receiptSlot: palette.purpleNight,
  onReceiptBg: palette.white,
  onReceiptBgMuted: 'rgba(255, 255, 255, 0.88)',
  receiptOutline: 'rgba(255, 255, 255, 0.55)',
  receiptButton: palette.white,
  onReceiptButton: palette.purpleDeep,
  receiptButtonRim: palette.purpleNight,
  receiptDash: '#D9D2E4',
  receiptTotal: palette.goldSoft,
  receiptTotalInk: '#7A4A00',
  receiptStreakInk: '#A83A08',
  receiptMilestoneInk: palette.purpleDeep,
  confetti: [
    palette.gold,
    palette.white,
    palette.green,
    palette.orange,
    palette.purpleOnDark,
    '#7FB0FF',
  ],
  /** The Estante opening corridor (ADR-046): darkness around the horizon and the two glows. */
  corridorBg: palette.night,
  corridorFade: [
    'rgba(20, 13, 31, 0.2)',
    'rgba(20, 13, 31, 0.92)',
    'rgba(20, 13, 31, 0.98)',
    'rgba(20, 13, 31, 0.92)',
    'rgba(20, 13, 31, 0.12)',
    'rgba(20, 13, 31, 0.55)',
    'rgba(20, 13, 31, 0.96)',
  ],
  corridorAmber: 'rgba(255, 170, 60, 0.12)',
  corridorViolet: 'rgba(124, 58, 237, 0.22)',
  spineShade: 'rgba(0, 0, 0, 0.25)',
  onCorridorMuted: palette.purpleOnDark,
  transparent: 'transparent',
} as const;

/**
 * The cozy 3D bookcase (Estante 3D, ADR-037): warm wood, a soft wall and a lamp glow. Wood is
 * the same object in both schemes; the wall and the glow are picked per scheme by the screen.
 */
export const shelfPalette = {
  wallTopLight: '#F8EEE0',
  wallBottomLight: '#ECDCC6',
  wallTopDark: '#2B1C36',
  wallBottomDark: '#180F22',
  /** Top face of a board (lit), front face and its lower edge. */
  woodTop: '#D9A46B',
  wood: '#B57A45',
  woodDark: '#8A5630',
  woodEdge: '#5E3A1E',
  /** Shadow a board casts on the wall and on the books below it. */
  boardShadow: 'rgba(60, 30, 10, 0.32)',
  /** Spine roundness: lit edge and shaded edge. */
  spineLight: 'rgba(255, 255, 255, 0.16)',
  spineShade: 'rgba(0, 0, 0, 0.26)',
  /** Warm lamp glow in the top corner. */
  lampLight: 'rgba(255, 200, 120, 0.45)',
  lampDark: 'rgba(255, 170, 80, 0.22)',
  transparent: 'transparent',
} as const;
