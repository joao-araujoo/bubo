import { type ShelfEntry } from '@bubo/contracts';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';

import { Button, EmptyState, FormScreen, Text } from '../design-system';
import { Bookcase3D } from '../features/shelf/Bookcase3D';
import { ShelfSpotlight } from '../features/shelf/ShelfSpotlight';
import { ApiError } from '../lib/api/client';
import { useShelf } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { shelfPalette, useTheme } from '../theme';

/** Padding of the wall around the bookcase. */
const WALL_PADDING = 14;

/**
 * Estante 3D (ADR-037): the reader's real shelf as a cozy wooden bookcase. Tapping a book pulls
 * it out and shows it in 3D with its real details; "Abrir livro" goes to the normal book screen.
 * Visualisation only: no status, rating or progress is changed here.
 */
export default function Bookcase3DScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const shelf = useShelf(userId);
  const [selected, setSelected] = useState<ShelfEntry | null>(null);
  const dark = theme.scheme === 'dark';
  const bookcaseWidth = Math.min(width, 520) - theme.sizes.gutter * 2 - WALL_PADDING * 2;

  if (!userId || shelf.isPending) {
    return (
      <FormScreen title="Estante 3D">
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando estante" />
      </FormScreen>
    );
  }
  if (shelf.isError && !shelf.data) {
    const retryable = shelf.error instanceof ApiError ? shelf.error.retryable : true;
    return (
      <FormScreen title="Estante 3D">
        <EmptyState
          mascot="error"
          title="Não foi possível montar a estante"
          description="Tente novamente para ver seus livros."
          action={
            retryable ? (
              <Button
                label="Tentar novamente"
                icon="refresh"
                loading={shelf.isFetching}
                onPress={() => void shelf.refetch()}
              />
            ) : undefined
          }
        />
      </FormScreen>
    );
  }

  const entries = shelf.data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <FormScreen title="Estante 3D">
        <EmptyState
          mascot="emptyShelf"
          title="Sua estante ainda está vazia"
          description="Adicione um livro e ele aparece aqui, de pé na prateleira."
          action={
            <Button
              label="Adicionar livro"
              icon="add"
              onPress={() => router.push('/adicionar-livro')}
            />
          }
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen title="Estante 3D">
      <Text variant="bodySm" color="textMuted" align="center">
        {entries.length} {entries.length === 1 ? 'livro' : 'livros'} · toque em um para tirá-lo da
        estante
      </Text>
      <View
        style={{
          alignSelf: 'center',
          borderRadius: theme.radii.card,
          overflow: 'hidden',
          padding: WALL_PADDING,
          paddingBottom: WALL_PADDING * 2,
        }}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[
            dark ? shelfPalette.wallTopDark : shelfPalette.wallTopLight,
            dark ? shelfPalette.wallBottomDark : shelfPalette.wallBottomLight,
          ]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <Bookcase3D
          entries={entries}
          width={bookcaseWidth}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
      </View>
      <ShelfSpotlight
        entry={selected}
        onClose={() => setSelected(null)}
        onOpen={(entry) => {
          setSelected(null);
          router.push({ pathname: '/livro/[id]', params: { id: entry.id } });
        }}
      />
    </FormScreen>
  );
}
