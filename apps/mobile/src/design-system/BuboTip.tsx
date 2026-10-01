import { type ComponentProps, type ReactNode } from 'react';
import { View } from 'react-native';

import { type MascotPose, type MascotState } from '../assets/registry';
import { useTheme } from '../theme';
import { BuboMascot } from './BuboMascot';
import { Icon } from './Icon';
import { Raised } from './Raised';
import { Text } from './Text';

type Mascot = { state: MascotState; pose?: never } | { pose: MascotPose; state?: never };

type Props = Mascot & {
  /** Bubble eyebrow, e.g. "Mediação do Bubo" / "DICA DO CURADOR BUBO". */
  title: string;
  titleIcon?: ComponentProps<typeof Icon>['name'];
  /** Uppercase, tracked eyebrow (most Stitch screens) or sentence case (forum mediation). */
  caps?: boolean;
  /** Right side of the eyebrow row (a Pill: "ANTI-SPOILERS ATIVO", "Meta 82% atingida"). */
  trailing?: ReactNode;
  children: ReactNode;
  /** `card`: white tactile container (default). `soft`: lavender container (Stitch diagnostics). */
  tone?: 'card' | 'soft';
  mascotSize?: number;
};

/**
 * Stitch "Mascot Companion Frame": the official owl next to a speech bubble with a bordered left
 * tail (DESIGN.md §3). Text is the reader's real situation, never an invented statistic.
 */
export function BuboTip({
  title,
  titleIcon = 'psychology',
  caps = true,
  trailing,
  children,
  tone = 'card',
  mascotSize = 64,
  ...mascot
}: Props) {
  const theme = useTheme();
  const bubbleBorder = theme.colors.border;
  const bubbleFill = tone === 'soft' ? theme.colors.surface : theme.colors.surfaceMuted;
  return (
    <Raised
      faceColor={tone === 'soft' ? theme.colors.surfaceMuted : theme.colors.surface}
      borderColor={tone === 'soft' ? theme.colors.primarySoft : theme.colors.borderSoft}
      rimColor={theme.colors.cardShadow}
      radius={22}
      depth={3}
      faceStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
      }}
    >
      {mascot.state ? (
        <BuboMascot state={mascot.state} size={mascotSize} />
      ) : (
        <BuboMascot pose={mascot.pose as MascotPose} size={mascotSize} />
      )}
      <View style={{ flex: 1, marginLeft: 4 }}>
        {/* Tail: outer triangle in the border colour, inner triangle in the bubble colour. */}
        <View
          style={{
            position: 'absolute',
            left: -9,
            top: 18,
            width: 0,
            height: 0,
            borderTopWidth: 7,
            borderBottomWidth: 7,
            borderRightWidth: 9,
            borderTopColor: theme.colors.transparent,
            borderBottomColor: theme.colors.transparent,
            borderRightColor: bubbleBorder,
          }}
        />
        <View
          style={{
            gap: theme.spacing.xs,
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: bubbleBorder,
            backgroundColor: bubbleFill,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Icon name={titleIcon} size={15} color="accentText" />
            <Text
              variant={caps ? 'caption' : 'label'}
              color="accentText"
              style={{ flexShrink: 1 }}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {trailing ? <View style={{ marginLeft: 'auto' }}>{trailing}</View> : null}
          </View>
          {typeof children === 'string' ? <Text variant="bodySm">{children}</Text> : children}
        </View>
        <View
          style={{
            position: 'absolute',
            left: -7,
            top: 19,
            width: 0,
            height: 0,
            borderTopWidth: 6,
            borderBottomWidth: 6,
            borderRightWidth: 8,
            borderTopColor: theme.colors.transparent,
            borderBottomColor: theme.colors.transparent,
            borderRightColor: bubbleFill,
          }}
        />
      </View>
    </Raised>
  );
}
