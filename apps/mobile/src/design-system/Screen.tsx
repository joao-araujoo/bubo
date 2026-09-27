import { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { OfflineBanner } from './OfflineBanner';

type Props = {
  children: ReactNode;
  /** Sticky content above the scroll area (e.g. the Home header). */
  header?: ReactNode;
  scroll?: boolean;
};

/** Screen container: safe areas, lavender canvas, 16pt gutters, offline banner. */
export function Screen({ children, header, scroll = true }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingHorizontal: theme.sizes.gutter,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, paddingTop: insets.top }}>
      {header ? (
        <View style={{ paddingHorizontal: theme.sizes.gutter, paddingVertical: theme.spacing.sm }}>
          {header}
        </View>
      ) : null}
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, { paddingTop: theme.spacing.sm }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[padding, { flex: 1 }]}>{children}</View>
      )}
    </View>
  );
}
