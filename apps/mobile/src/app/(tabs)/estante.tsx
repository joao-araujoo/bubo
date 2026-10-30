import { type ShelfEntry } from '@bubo/contracts';
import { toLocalIsoDate } from '@bubo/domain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  HeaderButton,
  Icon,
  InlineMessage,
  Screen,
  Text,
} from '../../design-system';
import {
  Collections,
  ContinueReading,
  RecentlyAdded,
  ShelfCircles,
} from '../../features/shelf/Library';
import { ShelfOpening } from '../../features/shelf/ShelfOpening';
import { TabHeader } from '../../features/shell/TabHeader';
import { ApiError } from '../../lib/api/client';
import { usePrefetchDiscover, useShelf } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

const EMPTY_ENTRIES: ShelfEntry[] = [];
const OPENING_KEY = 'bubo.estante-opening.v1';

/** The corridor opening shows at most once a local day, and only for a shelf with books. */
function useShelfOpening(ready: boolean) {
  const [state, setState] = useState<'unknown' | 'show' | 'hidden'>('unknown');
  useEffect(() => {
    if (!ready || state !== 'unknown') return;
    const today = toLocalIsoDate(new Date());
    AsyncStorage.getItem(OPENING_KEY)
      .then((seen) => setState(seen === today ? 'hidden' : 'show'))
      .catch(() => setState('hidden'));
  }, [ready, state]);
  return {
    visible: state === 'show',
    dismiss: () => {
      setState('hidden');
      AsyncStorage.setItem(OPENING_KEY, toLocalIsoDate(new Date())).catch(() => undefined);
    },
  };
}

/** Estante (ADR-046/047): tab header, search, shelves as circles, books in progress, collections, recents. */
export default function ShelfScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const shelf = useShelf(userId);
  usePrefetchDiscover(userId);
  const canUseShelfData =
    !shelf.isError || (shelf.error instanceof ApiError && shelf.error.retryable);
  const entries = canUseShelfData ? (shelf.data?.entries ?? EMPTY_ENTRIES) : EMPTY_ENTRIES;
  const opening = useShelfOpening(entries.length > 0);
  const openAdd = () =>
    router.push({ pathname: '/adicionar-livro', params: { status: 'want_to_read' } });
  const openDiscover = () => router.push({ pathname: '/descobrir', params: { focus: '1' } });

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <TabHeader
            title="Estante"
            actions={
              <>
                <HeaderButton
                  icon="shelves"
                  label="Ver estante 3D"
                  iconColor="accentText"
                  onPress={() => router.push('/estante-3d')}
                />
                <HeaderButton
                  icon="add"
                  label="Adicionar livro"
                  iconColor="accentText"
                  onPress={openAdd}
                />
              </>
            }
          />
        }
      >
        <View style={{ gap: theme.spacing.xl }}>
          <Pressable
            accessibilityRole="search"
            accessibilityLabel="Buscar livros para adicionar"
            accessibilityHint="Abre a busca e as recomendações do Descobrir"
            onPress={() => {
              haptics.selection();
              openDiscover();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              minHeight: 52,
              paddingHorizontal: theme.spacing.lg,
              borderRadius: theme.radii.pill,
              borderWidth: theme.sizes.borderWidth,
              borderColor: theme.colors.borderSoft,
              backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surface,
            })}
          >
            <Icon name="search" size={22} color="accentText" />
            <Text variant="body" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>
              Buscar livros ou ISBN
            </Text>
          </Pressable>

          {shelf.isPending || !userId ? (
            <ActivityIndicator
              color={theme.colors.primary}
              accessibilityLabel="Carregando sua estante"
            />
          ) : shelf.isError && (!shelf.data || !canUseShelfData) ? (
            <Card>
              <InlineMessage tone="error" message="Não foi possível carregar sua estante agora." />
              <Button
                label="Tentar de novo"
                variant="secondary"
                icon="refresh"
                onPress={() => void shelf.refetch()}
              />
            </Card>
          ) : entries.length === 0 ? (
            <Card>
              <EmptyState
                mascot="emptyShelf"
                title="Sua estante está esperando"
                description="Busque um livro, leia o código de barras ou explore as recomendações do Bubo."
                action={
                  <View style={{ gap: theme.spacing.sm, alignSelf: 'stretch' }}>
                    <Button label="Buscar livros" icon="search" fullWidth onPress={openDiscover} />
                    <Button
                      label="Adicionar livro"
                      icon="add"
                      variant="secondary"
                      fullWidth
                      onPress={openAdd}
                    />
                  </View>
                }
              />
            </Card>
          ) : (
            <>
              {shelf.isError ? (
                <Card>
                  <InlineMessage
                    tone="error"
                    message="Sua estante está salva aqui, mas não conseguimos atualizá-la agora."
                  />
                  <Button
                    label="Tentar atualizar"
                    variant="secondary"
                    icon="refresh"
                    size="md"
                    loading={shelf.isFetching}
                    onPress={() => void shelf.refetch()}
                  />
                </Card>
              ) : null}
              <ShelfCircles entries={entries} />
              <ContinueReading entries={entries} />
              <Collections entries={entries} />
              <RecentlyAdded entries={entries} />
              <Button
                label={
                  entries.length === 1
                    ? 'Ver o livro da estante'
                    : `Ver todos os ${entries.length} livros`
                }
                icon="grid-view"
                variant="secondary"
                onPress={() => router.push({ pathname: '/prateleira', params: { filtro: 'all' } })}
              />
            </>
          )}
        </View>
      </Screen>
      {opening.visible ? <ShelfOpening entries={entries} onDone={opening.dismiss} /> : null}
    </View>
  );
}
