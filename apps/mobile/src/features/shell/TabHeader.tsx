import { type ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '../../design-system';
import { useTheme } from '../../theme';
import { ProfileButton } from './ProfileButton';

/**
 * The one header of the tab screens (ADR-047): a large title naming the place, an optional line of
 * real context, at most two screen actions and the reader's avatar (Você) at the far right. Hoje
 * keeps its book-stage header (ADR-043); Você hides the avatar because it is that screen.
 */
export function TabHeader({
  title,
  subtitle,
  actions,
  profile = true,
}: {
  title: string;
  subtitle?: string;
  /** HeaderButtons for actions that belong to the whole screen. */
  actions?: ReactNode;
  profile?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.sizes.ctaHeight,
      }}
    >
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text
          variant="pageTitle"
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions || profile ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {actions}
          {profile ? <ProfileButton /> : null}
        </View>
      ) : null}
    </View>
  );
}
