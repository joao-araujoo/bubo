import { Tabs } from 'expo-router';
import { colors } from '../../src/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          minHeight: 68,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoje' }} />
      <Tabs.Screen name="library" options={{ title: 'Estante' }} />
      <Tabs.Screen name="review" options={{ title: 'Revisar' }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidade' }} />
      <Tabs.Screen name="you" options={{ title: 'Você' }} />
    </Tabs>
  );
}
