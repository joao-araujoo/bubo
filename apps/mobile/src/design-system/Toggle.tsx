import { type ComponentProps, type ReactNode } from 'react';
import { Switch, View } from 'react-native';

import { useTheme } from '../theme';
import { type Icon } from './Icon';
import { IconTile } from './IconTile';
import { Text } from './Text';

/**
 * Stitch setting row: title (+ optional badge), description and a purple switch. `locked` keeps a
 * rule that is always on (e.g. anti-spoiler) visible but not changeable.
 */
export function Toggle({
  title,
  description,
  value,
  onValueChange,
  locked = false,
  icon,
  badge,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange?: (next: boolean) => void;
  locked?: boolean;
  icon?: ComponentProps<typeof Icon>['name'];
  badge?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      {icon ? <IconTile icon={icon} size={40} /> : null}
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
            {title}
          </Text>
          {badge}
        </View>
        {description ? (
          <Text variant="bodySm" color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        accessibilityHint={locked ? 'Sempre ativo' : undefined}
        value={value}
        disabled={locked || !onValueChange}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor={theme.colors.surface}
        ios_backgroundColor={theme.colors.border}
      />
    </View>
  );
}
