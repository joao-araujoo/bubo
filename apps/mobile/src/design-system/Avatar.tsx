import { View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

/** Up to two initials from the reader's name ("Ana Leitora" → "AL"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Avatar de ${name}`}
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.primarySoft,
      }}
    >
      <Text variant="label" color="accentText">
        {initialsOf(name)}
      </Text>
    </View>
  );
}
