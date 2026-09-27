import { Text as RNText, type TextProps } from 'react-native';

import { type ColorTokens, type TypographyVariant, useTheme } from '../theme';

export type BuboTextProps = TextProps & {
  variant?: TypographyVariant;
  /** Any text-safe colour token. Defaults to `text`. */
  color?: keyof ColorTokens;
  align?: 'left' | 'center' | 'right';
};

/** The only text primitive: typography + colour always come from tokens. */
export function Text({ variant = 'body', color = 'text', align, style, ...rest }: BuboTextProps) {
  const theme = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
