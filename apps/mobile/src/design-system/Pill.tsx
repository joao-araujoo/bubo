import { type ComponentProps } from 'react';
import { View } from 'react-native';

import { type ColorTokens, fontFamily, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type PillTone =
  | 'primary'
  | 'primarySolid'
  | 'success'
  | 'successSolid'
  | 'warning'
  | 'error'
  | 'neutral'
  | 'gold'
  | 'orange'
  | 'blue';

const TONES: Record<
  PillTone,
  { bg: keyof ColorTokens; fg: keyof ColorTokens; border: keyof ColorTokens | null }
> = {
  primary: { bg: 'primarySoft', fg: 'accentText', border: null },
  primarySolid: { bg: 'primary', fg: 'onPrimary', border: null },
  success: { bg: 'successSoft', fg: 'successText', border: 'success' },
  successSolid: { bg: 'successText', fg: 'onSuccess', border: null },
  warning: { bg: 'goldSoft', fg: 'warningText', border: 'gold' },
  error: { bg: 'errorSoft', fg: 'errorText', border: 'error' },
  neutral: { bg: 'surfaceMuted', fg: 'textMuted', border: 'borderSoft' },
  gold: { bg: 'goldSoft', fg: 'warningText', border: null },
  orange: { bg: 'orangeSoft', fg: 'warningText', border: null },
  blue: { bg: 'blueSoft', fg: 'blue', border: null },
};

type Props = {
  label: string;
  tone?: PillTone;
  icon?: ComponentProps<typeof Icon>['name'];
  /** Small status dot before the label (Stitch "● Seguro para você"). */
  dot?: boolean;
  /** Uppercase, tracked label (Stitch "LIVRO DO MÊS", "HOJE"). */
  caps?: boolean;
  accessibilityLabel?: string;
};

/**
 * Stitch micro badge: 10–12 pt extrabold on a soft tint, optional 1 pt outline for semantic
 * tones. Smaller than `Chip`, which stays for counters and filters.
 */
export function Pill({
  label,
  tone = 'primary',
  icon,
  dot = false,
  caps = false,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const colors = TONES[tone];
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 3,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors[colors.bg],
        borderWidth: colors.border ? 1 : 0,
        borderColor: colors.border ? theme.colors[colors.border] : undefined,
      }}
    >
      {dot ? (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors[colors.fg],
          }}
        />
      ) : null}
      {icon ? <Icon name={icon} size={13} color={colors.fg} /> : null}
      <Text
        variant={caps ? 'caption' : 'bodySm'}
        color={colors.fg}
        style={
          caps ? undefined : { fontFamily: fontFamily.extrabold, fontSize: 12, lineHeight: 16 }
        }
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
