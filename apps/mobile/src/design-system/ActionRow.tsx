import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { haptics } from '../lib/haptics';
import { type ColorTokens, useTheme } from '../theme';
import { Icon } from './Icon';
import { Raised } from './Raised';
import { Text } from './Text';

/**
 * Stitch sheet/list action ("Adicionar Reflexão — Registre um insight antes que esfrie ›"):
 * raised row with an icon, title, optional subtitle and a trailing chevron or custom node.
 */
export function ActionRow({
  icon,
  iconColor = 'accentText',
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityHint,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  iconColor?: keyof ColorTokens;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.border}
          rimColor={theme.colors.secondaryRim}
          radius={theme.radii.lg}
          depth={3}
          pressed={pressed}
          faceStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            minHeight: 56,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
          }}
        >
          <Icon name={icon} size={24} color={iconColor} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">{title}</Text>
            {subtitle ? (
              <Text variant="bodySm" color="textMuted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {trailing ?? <Icon name="chevron-right" size={22} color="textMuted" />}
        </Raised>
      )}
    </Pressable>
  );
}
