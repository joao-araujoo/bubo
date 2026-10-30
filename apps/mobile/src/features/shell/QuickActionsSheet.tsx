import { type ShelfEntry } from '@bubo/contracts';
import { type Href, useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { BookCover, BottomSheet, Icon, Raised, Text } from '../../design-system';
import { useDueCards, useShelf } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { type ColorTokens, useTheme } from '../../theme';

type Action = {
  key: string;
  label: string;
  icon: ComponentProps<typeof Icon>['name'];
  face: keyof ColorTokens;
  ink: keyof ColorTokens;
  href: Href;
};

/** Quick actions behind the central "+" of the tab bar (ADR-043). Only real, available actions. */
export function QuickActionsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const shelf = useShelf(userId);
  const due = useDueCards(userId);
  const reading = shelf.data?.entries.find((entry) => entry.status === 'reading') ?? null;
  const dueCount = due.data?.cards.length ?? 0;

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const actions: Action[] = [
    ...(reading
      ? [
          {
            key: 'five',
            label: 'Ler 5 minutos',
            icon: 'timer' as const,
            face: 'orangeSoft' as const,
            ink: 'orange' as const,
            href: { pathname: '/sessao/[id]', params: { id: reading.id, goal: '5' } } as const,
          },
        ]
      : []),
    {
      key: 'add',
      label: 'Adicionar livro',
      icon: 'library-add',
      face: 'primarySoft',
      ink: 'accentText',
      href: '/adicionar-livro',
    },
    {
      key: 'scan',
      label: 'Escanear código',
      icon: 'qr-code-scanner',
      face: 'blueSoft',
      ink: 'blue',
      href: '/scanner-isbn',
    },
    {
      key: 'search',
      label: 'Buscar livros',
      icon: 'search',
      face: 'surfaceMuted',
      ink: 'accentText',
      href: '/descobrir',
    },
    ...(dueCount > 0
      ? [
          {
            key: 'review',
            label: dueCount === 1 ? 'Revisar 1 card' : `Revisar ${dueCount} cards`,
            icon: 'lightbulb' as const,
            face: 'successSoft' as const,
            ink: 'successText' as const,
            href: '/revisao' as const,
          },
        ]
      : []),
    ...(reading
      ? [
          {
            key: 'page',
            label: 'Atualizar página',
            icon: 'bookmark' as const,
            face: 'goldSoft' as const,
            ink: 'goldRim' as const,
            href: { pathname: '/livro/[id]', params: { id: reading.id } } as const,
          },
        ]
      : []),
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Ações rápidas">
      <View style={{ paddingHorizontal: theme.sizes.gutter, gap: theme.spacing.md }}>
        <Text variant="title" accessibilityRole="header">
          Ações rápidas
        </Text>
        {reading ? <ContinueRow entry={reading} onPress={() => go(continueHref(reading))} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPressIn={() => haptics.press()}
              onPress={() => go(action.href)}
              style={{ width: '31.5%' }}
            >
              {({ pressed }) => (
                <Raised
                  faceColor={theme.colors.surface}
                  borderColor={theme.colors.borderSoft}
                  rimColor={theme.colors.cardShadow}
                  radius={theme.radii.lg}
                  depth={theme.sizes.cardRim}
                  pressed={pressed}
                  faceStyle={{
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    paddingVertical: theme.spacing.md,
                    paddingHorizontal: theme.spacing.xs,
                    minHeight: 96,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: theme.radii.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: theme.colors[action.face],
                    }}
                  >
                    <Icon name={action.icon} size={24} color={action.ink} />
                  </View>
                  <Text variant="label" align="center" numberOfLines={2}>
                    {action.label}
                  </Text>
                </Raised>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const continueHref = (entry: ShelfEntry): Href => ({
  pathname: '/sessao/[id]',
  params: { id: entry.id },
});

function ContinueRow({ entry, onPress }: { entry: ShelfEntry; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continuar ${entry.book.title}`}
      onPressIn={() => haptics.commit()}
      onPress={onPress}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.primary}
          borderColor={theme.colors.primary}
          rimColor={theme.colors.primaryRim}
          radius={theme.radii.card}
          depth={theme.sizes.rim}
          pressed={pressed}
          faceStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.md,
          }}
        >
          <BookCover
            title={entry.book.title}
            author={entry.book.author}
            coverUrls={entry.book.coverUrls}
            width={40}
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" color="onPrimary" numberOfLines={1}>
              Continuar {entry.book.title}
            </Text>
            <Text variant="bodySm" color="onHeroMuted">
              Pág. {entry.currentPage}
            </Text>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surface,
            }}
          >
            <Icon name="play-arrow" size={24} color="accentText" />
          </View>
        </Raised>
      )}
    </Pressable>
  );
}
