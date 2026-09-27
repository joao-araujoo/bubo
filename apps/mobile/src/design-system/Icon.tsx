import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type ComponentProps } from 'react';

import { type ColorTokens, useTheme } from '../theme';

type Props = {
  name: ComponentProps<typeof MaterialIcons>['name'];
  size?: number;
  color?: keyof ColorTokens;
};

/** Material icons (the Stitch reference uses Material Symbols). Decorative by default. */
export function Icon({ name, size = 24, color = 'text' }: Props) {
  const theme = useTheme();
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={theme.colors[color]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
