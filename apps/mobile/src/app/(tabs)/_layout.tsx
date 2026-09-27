import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../design-system';
import { useDueCards } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type IconName = ComponentProps<typeof Icon>['name'];

/** Exactly five tabs — Hoje, Estante, Revisar, Comunidade, Você. No AI/Chat tab. */
const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Hoje', icon: 'home', iconActive: 'home' },
  { name: 'estante', title: 'Estante', icon: 'menu-book', iconActive: 'menu-book' },
  { name: 'revisar', title: 'Revisar', icon: 'lightbulb-outline', iconActive: 'lightbulb' },
  { name: 'comunidade', title: 'Comunidade', icon: 'groups', iconActive: 'groups' },
  { name: 'voce', title: 'Você', icon: 'person-outline', iconActive: 'person' },
];

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuthState();
  const due = useDueCards(auth.status === 'ready' ? auth.userId : undefined);
  const dueCount = due.data?.dueCount ?? 0;
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptics.selection() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accentText,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          ...theme.typography.caption,
          textTransform: 'none',
          fontSize: 11,
          textAlign: 'center',
          width: '100%',
          marginHorizontal: 0,
        },
        tabBarItemStyle: {
          flex: 1,
          flexBasis: 0,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: theme.sizes.borderWidth,
          height: theme.sizes.tabBarHeight + insets.bottom,
          paddingTop: theme.spacing.xs,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel:
              tab.name === 'revisar' && dueCount > 0
                ? `${tab.title}, ${dueCount} ${dueCount === 1 ? 'card pendente' : 'cards pendentes'}`
                : tab.title,
            // Real due-review count (never a decorative number).
            tabBarBadge:
              tab.name === 'revisar' && dueCount > 0
                ? dueCount > 99
                  ? '99+'
                  : dueCount
                : undefined,
            tabBarBadgeStyle: {
              backgroundColor: theme.colors.primary,
              color: theme.colors.onPrimary,
              fontFamily: theme.fontFamily.bold,
              fontSize: 11,
            },
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  width: 48,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.pill,
                  backgroundColor: focused ? theme.colors.primarySoft : theme.colors.transparent,
                }}
              >
                <Icon
                  name={focused ? tab.iconActive : tab.icon}
                  size={24}
                  color={focused ? 'accentText' : 'textMuted'}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
