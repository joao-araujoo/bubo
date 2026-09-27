import { type ShelfEntry } from '@bubo/contracts';
import { readingProgress, type ReadingStatus } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  BookCover,
  Button,
  Card,
  EmptyState,
  Icon,
  InlineMessage,
  ProgressBar,
  Screen,
  Text,
} from '../../design-system';
import { useShelf } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type Filter = 'all' | 'reading' | 'want_to_read' | 'finished';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'reading', label: 'Lendo' },
  { id: 'want_to_read', label: 'Quero ler' },
  { id: 'finished', label: 'Lidos' },
];

function ShelfRow({ entry }: { entry: ShelfEntry }) {
  const theme = useTheme();
  const router = useRouter();
  const progress = readingProgress(entry.currentPage, entry.book.totalPages ?? 0);
  const status: Record<ReadingStatus, string> = {
    reading: 'Lendo',
    want_to_read: 'Quero ler',
    paused: 'Pausado',
    finished: 'Lido',
    abandoned: 'Abandonado',
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.book.title}, ${status[entry.status]}${progress.totalPages > 0 ? `, ${progress.percent}%` : ''}`}
      accessibilityHint="Abre os detalhes do livro"
      onPress={() => {
        haptics.selection();
        router.push({ pathname: '/livro/[id]', params: { id: entry.id } });
      }}
    >
      <Card style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <BookCover
            title={entry.book.title}
            author={entry.book.author}
            coverUrls={entry.book.coverUrls}
            width={72}
          />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="titleSm" numberOfLines={2}>
              {entry.book.title}
            </Text>
            {entry.book.author ? (
              <Text variant="bodySm" color="textMuted" numberOfLines={1}>
                {entry.book.author}
              </Text>
            ) : null}
            <Text variant="label" color="accentText">
              {status[entry.status]}
            </Text>
            {progress.totalPages > 0 && entry.status === 'reading' ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodySm" color="textMuted">
                    Pág. {progress.currentPage} de {progress.totalPages}
                  </Text>
                  <Text variant="label" color="accentText">
                    {progress.percent}%
                  </Text>
                </View>
                <ProgressBar
                  percent={progress.percent}
                  accessibilityLabel={`Progresso de leitura: ${progress.percent}%`}
                />
              </>
            ) : null}
          </View>
          <Icon name="chevron-right" size={24} color="textMuted" />
        </View>
      </Card>
    </Pressable>
  );
}

export default function ShelfScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const shelf = useShelf(auth.status === 'ready' ? auth.userId : undefined);
  const [filter, setFilter] = useState<Filter>('all');
  const entries = shelf.data?.entries ?? [];
  const filtered = filter === 'all' ? entries : entries.filter((entry) => entry.status === filter);
  const openAdd = () => router.push('/adicionar-livro');

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="heading" accessibilityRole="header">
              Minha Estante
            </Text>
            <Text variant="bodySm" color="textMuted">
              Cognição & leitura profunda
            </Text>
          </View>
          <Button label="+ Livro" size="md" onPress={openAdd} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {FILTERS.map((option) => {
          const count =
            option.id === 'all'
              ? entries.length
              : entries.filter((entry) => entry.status === option.id).length;
          const selected = filter === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}, ${count} livros`}
              onPress={() => {
                haptics.selection();
                setFilter(option.id);
              }}
              style={{
                minHeight: theme.sizes.touchTarget,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radii.pill,
                borderWidth: theme.sizes.borderWidth,
                borderColor: selected ? theme.colors.primary : theme.colors.borderSoft,
                backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="label" color={selected ? 'onPrimary' : 'textMuted'}>
                {option.label} {count > 0 ? count : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {shelf.isPending ? (
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="Carregando sua estante"
        />
      ) : shelf.isError ? (
        <Card>
          <InlineMessage tone="error" message="Não foi possível carregar sua estante agora." />
          <Button
            label="Tentar de novo"
            variant="secondary"
            icon="refresh"
            onPress={() => void shelf.refetch()}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            mascot="emptyShelf"
            title={entries.length === 0 ? 'Sua estante está vazia' : 'Nenhum livro nesta categoria'}
            description={
              entries.length === 0
                ? 'Encontre o livro que você está lendo ou adicione um à mão.'
                : 'Seus livros aparecerão aqui quando mudarem para este status.'
            }
            action={
              <Button
                label={entries.length === 0 ? 'Adicionar livro' : 'Ver todos'}
                icon={entries.length === 0 ? 'add' : 'menu-book'}
                fullWidth
                onPress={entries.length === 0 ? openAdd : () => setFilter('all')}
              />
            }
          />
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="caption" color="textMuted" accessibilityRole="header">
            {filter === 'all'
              ? 'SEUS LIVROS'
              : FILTERS.find((option) => option.id === filter)?.label.toUpperCase()}
          </Text>
          {filtered.map((entry) => (
            <ShelfRow key={entry.id} entry={entry} />
          ))}
        </View>
      )}
    </Screen>
  );
}
