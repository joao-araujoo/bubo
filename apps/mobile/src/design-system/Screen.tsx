import { createContext, type ReactNode, useContext } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { OfflineBanner } from './OfflineBanner';

/**
 * Extra bottom space a screen must leave free. The tab layout provides the height of the floating
 * tab bar (ADR-043); screens outside the tabs keep 0.
 */
export const ScreenBottomInset = createContext(0);

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
  const bottomInset = useContext(ScreenBottomInset);
  const padding = {
    paddingHorizontal: theme.sizes.gutter,
    paddingBottom: theme.spacing.xxl + bottomInset,
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
