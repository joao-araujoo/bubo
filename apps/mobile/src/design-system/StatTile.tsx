import { type ComponentProps, type ReactNode } from 'react';
import { View } from 'react-native';

import { type ColorTokens, useTheme } from '../theme';
import { type Icon } from './Icon';
import { IconTile, type IconTileTone } from './IconTile';
import { Raised } from './Raised';
import { Text } from './Text';

type Props = {
  /** Uppercase label, e.g. "MEMBROS", "HÁBITO & FOCO". */
  label: string;
  value: string;
  /** Small unit after the value ("dias", "/100", "pág/sem"). */
  unit?: string;
  icon: ComponentProps<typeof Icon>['name'];
  tone?: IconTileTone;
  /** Colour of the value (Stitch paints some values green or purple). */
  valueColor?: keyof ColorTokens;
  /** Line or Pill under the value. */
  footer?: ReactNode;
  accessibilityLabel?: string;
};

/** Stitch 2×2 metric tile: caps label + icon backplate, headline value with unit, footer. */
export function StatTile({
  label,
  value,
  unit,
  icon,
  tone = 'primary',
  valueColor = 'text',
  footer,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}${unit ? ` ${unit}` : ''}`}
      style={{ flex: 1 }}
    >
      <Raised
        faceColor={theme.colors.surface}
        borderColor={theme.colors.borderSoft}
        rimColor={theme.colors.cardShadow}
        radius={20}
        depth={theme.sizes.cardRim}
        style={{ flexGrow: 1 }}
        faceStyle={{ flexGrow: 1, padding: theme.spacing.md, gap: theme.spacing.xs }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
          <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
            {label}
          </Text>
          <IconTile icon={icon} tone={tone} size={28} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs }}>
          <Text variant="heading" color={valueColor} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          {unit ? (
            <Text variant="bodySm" color="textMuted" style={{ flexShrink: 1 }} numberOfLines={1}>
              {unit}
            </Text>
          ) : null}
        </View>
        {typeof footer === 'string' ? (
          <Text variant="bodySm" color="textMuted" style={{ fontSize: 12, lineHeight: 16 }}>
            {footer}
          </Text>
        ) : (
          footer
        )}
      </Raised>
    </View>
  );
}
