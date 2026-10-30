import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBottomInset } from '../../design-system';
import { FLOATING_TAB_BAR, FloatingTabBar } from '../../features/shell/FloatingTabBar';
import { useDueCards } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';

/**
 * Tabs (ADR-043): Hoje, Estante, Revisar and Comunidade in a floating bar with a central
 * quick-actions "+". "Você" keeps its route and opens from the profile avatar. No AI/Chat tab.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const auth = useAuthState();
  const due = useDueCards(auth.status === 'ready' ? auth.userId : undefined);
  // What Revisar offers today (the daily limit applies), never a decorative number.
  const dueCount = due.data?.cards.length ?? 0;
  return (
    <ScreenBottomInset.Provider
      value={FLOATING_TAB_BAR.height + FLOATING_TAB_BAR.gap + insets.bottom}
    >
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <FloatingTabBar {...props} dueCount={dueCount} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Hoje' }} />
        <Tabs.Screen name="estante" options={{ title: 'Estante' }} />
        <Tabs.Screen name="revisar" options={{ title: 'Revisar' }} />
        <Tabs.Screen name="comunidade" options={{ title: 'Comunidade' }} />
        <Tabs.Screen name="voce" options={{ title: 'Você' }} />
      </Tabs>
    </ScreenBottomInset.Provider>
  );
}
