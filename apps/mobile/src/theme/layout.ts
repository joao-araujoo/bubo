/** 4/8pt spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  input: 14,
  lg: 16,
  card: 24,
  pill: 999,
} as const;

export const sizes = {
  /** Screen edge margin on phones. */
  gutter: 16,
  /** Minimum touch target (WCAG / platform guidelines). */
  touchTarget: 48,
  /** Primary call-to-action height. */
  ctaHeight: 56,
  tabBarHeight: 64,
  progressTrack: 12,
  borderWidth: 2,
  /** Pushdown "3D" rim of tactile buttons and cards. */
  rim: 5,
  rimPressed: 2,
  cardRim: 4,
} as const;

/** Motion tokens. Always honour the OS "reduce motion" setting (see src/lib/motion.ts). */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  enterOffset: 8,
} as const;
