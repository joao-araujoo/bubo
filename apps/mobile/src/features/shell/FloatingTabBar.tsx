import { type Tabs } from 'expo-router';
import { type ComponentProps, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Raised, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { QuickActionsSheet } from './QuickActionsSheet';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = ComponentProps<typeof Icon>['name'];

/** Height of the floating bar and its gap to the screen edges (ADR-043/047). */
export const FLOATING_TAB_BAR = { height: 72, gap: 10 } as const;

/**
 * Starting widths of the tab slots; spare width is shared equally. The edge tabs start wider so
 * "Comunidade" stays clear of the bar's rounded ends, and the layout stays symmetric so the "+"
 * keeps the exact centre.
 */
const SLOT = { edge: 72, inner: 56, action: 56 } as const;

const TABS: Record<string, { title: string; icon: IconName; iconActive: IconName }> = {
  index: { title: 'Hoje', icon: 'home', iconActive: 'home' },
  estante: { title: 'Estante', icon: 'menu-book', iconActive: 'menu-book' },
  revisar: { title: 'Revisar', icon: 'lightbulb-outline', iconActive: 'lightbulb' },
  comunidade: { title: 'Comunidade', icon: 'groups', iconActive: 'groups' },
};

/**
 * Floating, detached tab bar: Hoje, Estante, the quick-actions "+", Revisar and Comunidade.
 * Every tab shows its icon and label; the selected one sits in a soft pill (one indicator, no
 * extra dot) (ADR-047). "Você" stays a tab route but opens from the avatar in each tab header.
 */
export function FloatingTabBar({
  state,
  navigation,
  dueCount,
}: TabBarProps & {
  /** Real due-review count (never a decorative number). */
  dueCount: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [actions, setActions] = useState(false);
  const current = state.routes[state.index]?.name;

  const tab = (name: keyof typeof TABS, edge: boolean) => {
    const route = state.routes.find((candidate) => candidate.name === name);
    const meta = TABS[name];
    if (!route || !meta) return null;
    const focused = current === name;
    const badge = name === 'revisar' && dueCount > 0 ? dueCount : 0;
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={
          badge
            ? `${meta.title}, ${badge} ${badge === 1 ? 'card pendente' : 'cards pendentes'}`
            : meta.title
        }
        onPress={() => {
          haptics.selection();
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: edge ? SLOT.edge : SLOT.inner,
          minHeight: theme.sizes.touchTarget + theme.spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <View
          style={{
            width: 56,
            height: 32,
            borderRadius: theme.radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: focused ? theme.colors.primarySoft : theme.colors.transparent,
          }}
        >
          <Icon
            name={focused ? meta.iconActive : meta.icon}
            size={24}
            color={focused ? 'accentText' : 'textMuted'}
          />
          {badge ? (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: 4,
                minWidth: 20,
                height: 20,
                paddingHorizontal: 4,
                borderRadius: theme.radii.pill,
                borderWidth: theme.sizes.borderWidth,
                borderColor: theme.colors.surface,
                backgroundColor: theme.colors.error,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                variant="labelSm"
                color="onPrimary"
                maxFontSizeMultiplier={1}
                style={{ fontSize: 10, lineHeight: 12 }}
              >
                {badge > 99 ? '99+' : String(badge)}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          variant="tabLabel"
          color={focused ? 'accentText' : 'textMuted'}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          maxFontSizeMultiplier={1.2}
        >
          {meta.title}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: FLOATING_TAB_BAR.gap,
          right: FLOATING_TAB_BAR.gap,
          bottom: insets.bottom + FLOATING_TAB_BAR.gap,
          height: FLOATING_TAB_BAR.height,
        }}
      >
        <View
          accessibilityRole="tablist"
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            // Keeps the edge labels inside the rounded ends.
            paddingHorizontal: 10,
            borderRadius: FLOATING_TAB_BAR.height / 2,
            borderWidth: theme.sizes.borderWidth,
            borderColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.surface,
            shadowColor: theme.colors.primaryRim,
            shadowOpacity: 0.2,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
        >
          {tab('index', true)}
          {tab('estante', false)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ações rápidas"
            accessibilityHint="Abre atalhos para ler, adicionar livros e revisar"
            onPressIn={() => haptics.commit()}
            onPress={() => setActions(true)}
            // Centred inside the bar like the tabs (face + rim), not floating above it.
            style={{ width: SLOT.action, alignItems: 'center' }}
          >
            {({ pressed }) => (
              <Raised
                faceColor={theme.colors.primary}
                borderColor={theme.colors.primary}
                rimColor={theme.colors.primaryRim}
                radius={theme.radii.pill}
                depth={theme.sizes.rim}
                pressed={pressed}
                faceStyle={{
                  width: 52,
                  height: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="add" size={28} color="onPrimary" />
              </Raised>
            )}
          </Pressable>
          {tab('revisar', false)}
          {tab('comunidade', true)}
        </View>
      </View>
      <QuickActionsSheet visible={actions} onClose={() => setActions(false)} />
    </>
  );
}
