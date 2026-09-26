import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radii } from '../../theme/tokens';

type Props = PropsWithChildren<{
  style?: ViewStyle | ViewStyle[];
}>;

export function BuboCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: '#E9E3F5',
    borderWidth: 2,
    borderBottomColor: colors.border,
    borderBottomWidth: 5,
    borderRadius: radii.card,
    padding: 16,
  },
});
