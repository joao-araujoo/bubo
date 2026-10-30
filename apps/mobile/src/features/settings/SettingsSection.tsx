import { type ComponentProps, type ReactNode } from 'react';
import { View } from 'react-native';

import { Card, type Icon, IconTile, type IconTileTone, Text } from '../../design-system';
import { useTheme } from '../../theme';

/** Stitch settings block: icon backplate, title + subtitle, divider, then the controls. */
export function SettingsSection({
  icon,
  tone = 'primary',
  title,
  subtitle,
  children,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  tone?: IconTileTone;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <IconTile icon={icon} tone={tone} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="titleSm" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySm" color="textMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />
      {children}
    </Card>
  );
}

export function FieldLabel({ label, trailing }: { label: string; trailing?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text variant="label">{label}</Text>
      {trailing}
    </View>
  );
}
