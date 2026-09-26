import { Tabs } from 'expo-router';
import { colors, fonts } from '../../src/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          minHeight: 72,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: fonts.bold,
        },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Hoje' }} />
      <Tabs.Screen name="library" options={{ title: 'Estante' }} />
      <Tabs.Screen name="review" options={{ title: 'Revisar' }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidade' }} />
      <Tabs.Screen name="you" options={{ title: 'Você' }} />
    </Tabs>
  );
}
