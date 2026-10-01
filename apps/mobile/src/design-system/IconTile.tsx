import { type ComponentProps } from 'react';
import { View } from 'react-native';

import { type ColorTokens, useTheme } from '../theme';
import { Icon } from './Icon';

export type IconTileTone = 'primary' | 'gold' | 'orange' | 'success' | 'blue' | 'error' | 'neutral';

const TONES: Record<
  IconTileTone,
  { bg: keyof ColorTokens; fg: keyof ColorTokens; solidBg: keyof ColorTokens }
> = {
  primary: { bg: 'primarySoft', fg: 'accentText', solidBg: 'primary' },
  gold: { bg: 'goldSoft', fg: 'goldRim', solidBg: 'gold' },
  orange: { bg: 'orangeSoft', fg: 'orange', solidBg: 'orange' },
  success: { bg: 'successSoft', fg: 'successText', solidBg: 'success' },
  blue: { bg: 'blueSoft', fg: 'blue', solidBg: 'blue' },
  error: { bg: 'errorSoft', fg: 'errorText', solidBg: 'error' },
  neutral: { bg: 'surfaceMuted', fg: 'textMuted', solidBg: 'textMuted' },
};

type Props = {
  icon: ComponentProps<typeof Icon>['name'];
  tone?: IconTileTone;
  size?: number;
  /** Filled backplate with a white glyph (Stitch club badge, "Desafio semanal"). */
  solid?: boolean;
  /** Circle instead of a squircle (Stitch stat tiles on the achievements wall). */
  round?: boolean;
};

/** Stitch icon backplate: a soft tinted squircle holding a Material icon. Decorative. */
export function IconTile({
  icon,
  tone = 'primary',
  size = 40,
  solid = false,
  round = false,
}: Props) {
  const theme = useTheme();
  const colors = TONES[tone];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: round ? theme.radii.pill : Math.round(size * 0.3),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors[solid ? colors.solidBg : colors.bg],
      }}
    >
      <Icon
        name={icon}
        size={Math.round(size * 0.55)}
        color={solid ? (tone === 'gold' ? 'text' : 'onPrimary') : colors.fg}
      />
    </View>
  );
}
