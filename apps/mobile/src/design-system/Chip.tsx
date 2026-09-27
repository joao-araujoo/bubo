import { type ComponentProps } from 'react';
import { View } from 'react-native';

import { type ColorTokens, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type ChipTone = 'primary' | 'gold' | 'orange' | 'success' | 'neutral';

const tones: Record<ChipTone, { bg: keyof ColorTokens; fg: keyof ColorTokens }> = {
  primary: { bg: 'primarySoft', fg: 'accentText' },
  gold: { bg: 'goldSoft', fg: 'text' },
  orange: { bg: 'orangeSoft', fg: 'text' },
  success: { bg: 'success', fg: 'onSuccess' },
  neutral: { bg: 'surfaceMuted', fg: 'textMuted' },
};

type Props = {
  label: string;
  tone?: ChipTone;
  icon?: ComponentProps<typeof Icon>['name'];
  iconColor?: keyof ColorTokens;
  /** Section eyebrow style (uppercase caption). */
  eyebrow?: boolean;
  /** Horizontal placement inside a column (default: start). */
  align?: 'start' | 'center';
  accessibilityLabel?: string;
};

/** Small pill for status, eyebrows ("LENDO AGORA") and counters (streak / XP). */
export function Chip({
  label,
  tone = 'primary',
  icon,
  iconColor,
  eyebrow = false,
  align = 'start',
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const colors = tones[tone];
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: align === 'center' ? 'center' : 'flex-start',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs + 2,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors[colors.bg],
      }}
    >
      {icon ? <Icon name={icon} size={16} color={iconColor ?? colors.fg} /> : null}
      <Text variant={eyebrow ? 'caption' : 'label'} color={colors.fg}>
        {label}
      </Text>
    </View>
  );
}
