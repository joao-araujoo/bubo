import { type ComponentProps, type ReactNode } from 'react';
import { View } from 'react-native';

import { type ColorTokens, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  icon?: ComponentProps<typeof Icon>['name'];
  iconColor?: keyof ColorTokens;
  /** Right-aligned meta (e.g. "5/7 dias", "+20 XP"). */
  trailing?: ReactNode;
};

/** Card section title row: icon + uppercase caption title + optional trailing meta. */
export function SectionHeader({ title, icon, iconColor = 'accentText', trailing }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      {icon ? <Icon name={icon} size={20} color={iconColor} /> : null}
      <Text variant="caption" color="textMuted" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}
