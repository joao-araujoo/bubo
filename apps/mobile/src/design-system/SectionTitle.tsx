import { type ComponentProps, type ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * Stitch section heading outside cards ("TÓPICOS RECENTES DA COMUNIDADE", "COLEÇÃO DE MEDALHAS"):
 * purple icon, tracked uppercase title in ink, optional subtitle and a trailing link or pill.
 */
export function SectionTitle({
  title,
  icon,
  subtitle,
  trailing,
}: {
  title: string;
  icon?: ComponentProps<typeof Icon>['name'];
  subtitle?: string;
  trailing?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      {icon ? <Icon name={icon} size={20} color="accentText" /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          variant="caption"
          accessibilityRole="header"
          style={{ fontSize: 13, lineHeight: 17, letterSpacing: 0.9 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
