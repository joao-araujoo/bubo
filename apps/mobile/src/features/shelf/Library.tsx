import { type ShelfEntry } from '@bubo/contracts';
import {
  type LibraryShelf,
  SHORT_BOOK_PAGES,
  finishedInYear,
  inLibraryShelf,
  libraryCounts,
  readingProgress,
} from '@bubo/domain';
import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BookCover, Icon, ProgressBar, Raised, SectionTitle, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { type ColorTokens, useTheme } from '../../theme';

type IconName = ComponentProps<typeof Icon>['name'];

/**
 * The Estante home (ADR-046, after the Bookify reference the owner approved; tab header since
 * ADR-047): the reader's shelves as circles, books in progress, collections and the latest
 * additions. Every count and cover is the reader's own shelf.
 */

export const SHELF_META: Record<LibraryShelf, { label: string; icon: IconName }> = {
  reading: { label: 'Lendo', icon: 'auto-stories' },
  want_to_read: { label: 'Quero ler', icon: 'bookmark-border' },
  finished: { label: 'Lidos', icon: 'check-circle-outline' },
  favorite: { label: 'Favoritos', icon: 'favorite-border' },
  owned: { label: 'Tenho', icon: 'inventory-2' },
  wishlist: { label: 'Desejados', icon: 'card-giftcard' },
  paused: { label: 'Pausados', icon: 'pause-circle-outline' },
  abandoned: { label: 'Abandonei', icon: 'block' },
};

/** Always shown, in this order; the other shelves join when they have books. */
const MAIN_SHELVES: readonly LibraryShelf[] = [
  'reading',
  'want_to_read',
  'finished',
  'favorite',
  'owned',
];
const EXTRA_SHELVES: readonly LibraryShelf[] = ['wishlist', 'paused', 'abandoned'];

function openShelf(router: ReturnType<typeof useRouter>, filtro: string, ano?: number) {
  haptics.selection();
  router.push({
    pathname: '/prateleira',
    params: ano === undefined ? { filtro } : { filtro, ano: String(ano) },
  });
}

export function LibrarySection({
  title,
  link,
  onLink,
  children,
}: {
  title: string;
  link?: string;
  onLink?: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionTitle title={title} link={link} onLink={onLink} />
      {children}
    </View>
  );
}

function HorizontalRow({ children, gap }: { children: ReactNode; gap?: number }) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -theme.sizes.gutter }}
      contentContainerStyle={{
        gap: gap ?? theme.spacing.md + 2,
        paddingHorizontal: theme.sizes.gutter,
        paddingVertical: theme.spacing.xs,
      }}
    >
      {children}
    </ScrollView>
  );
}

/** The reader's shelves as round covers with counts (Bookify "Estantes"). */
export function ShelfCircles({ entries }: { entries: readonly ShelfEntry[] }) {
  const theme = useTheme();
  const router = useRouter();
  const counts = libraryCounts(entries);
  const shelves = [
    ...MAIN_SHELVES,
    ...EXTRA_SHELVES.filter((shelf) => counts[shelf] > 0 || shelf === 'abandoned'),
  ];
  return (
    <LibrarySection title="Estantes">
      <HorizontalRow>
        {shelves.map((shelf) => {
          const first = entries.find((entry) => inLibraryShelf(entry, shelf));
          const count = counts[shelf];
          return (
            <Pressable
              key={shelf}
              accessibilityRole="button"
              accessibilityLabel={`${SHELF_META[shelf].label}, ${count} ${count === 1 ? 'livro' : 'livros'}`}
              onPress={() => openShelf(router, shelf)}
              style={({ pressed }) => ({
                width: 82,
                alignItems: 'center',
                gap: theme.spacing.sm,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  padding: 3,
                  borderRadius: 43,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: theme.colors.purpleLight,
                }}
              >
                <View
                  style={{
                    width: 74,
                    height: 74,
                    borderRadius: 37,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.surfaceMuted,
                  }}
                >
                  {first ? (
                    <View style={{ marginTop: 24 }}>
                      <BookCover
                        title={first.book.title}
                        author={first.book.author}
                        coverUrls={first.book.coverUrls}
                        width={80}
                      />
                    </View>
                  ) : (
                    <Icon name={SHELF_META[shelf].icon} size={30} color="textMuted" />
                  )}
                </View>
                <View
                  style={{
                    position: 'absolute',
                    right: 2,
                    bottom: 4,
                    minWidth: 24,
                    height: 24,
                    paddingHorizontal: 6,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1.5,
                    borderColor: theme.colors.borderSoft,
                  }}
                >
                  <Text variant="labelSm">{count}</Text>
                </View>
              </View>
              <Text variant="label" numberOfLines={1} style={{ fontSize: 14 }}>
                {SHELF_META[shelf].label}
              </Text>
            </Pressable>
          );
        })}
      </HorizontalRow>
    </LibrarySection>
  );
}

/** Books in progress as wide cards with a progress line. */
export function ContinueReading({ entries }: { entries: readonly ShelfEntry[] }) {
  const theme = useTheme();
  const router = useRouter();
  const reading = entries.filter((entry) => entry.status === 'reading');
  if (reading.length === 0) return null;
  return (
    <LibrarySection title="Continuar lendo">
      <HorizontalRow gap={theme.spacing.sm + 2}>
        {reading.map((entry) => {
          const progress = readingProgress(entry.currentPage, entry.book.totalPages ?? 0);
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`${entry.rereading ? 'Relendo ' : ''}${entry.book.title}${progress.totalPages > 0 ? `, ${progress.percent}% lido` : ''}`}
              accessibilityHint="Abre o livro"
              onPress={() => {
                haptics.selection();
                router.push({ pathname: '/livro/[id]', params: { id: entry.id } });
              }}
              style={({ pressed }) => ({
                width: 252,
                minHeight: 78,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm + 2,
                paddingVertical: 6,
                paddingLeft: theme.spacing.sm,
                paddingRight: theme.spacing.md,
                borderRadius: theme.radii.lg,
                backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surface,
              })}
            >
              <BookCover
                title={entry.book.title}
                author={entry.book.author}
                coverUrls={entry.book.coverUrls}
                width={40}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyStrong" numberOfLines={1} style={{ fontSize: 16 }}>
                  {entry.book.title}
                </Text>
                <Text variant="bodySm" color="textMuted" numberOfLines={1}>
                  {entry.rereading ? 'Relendo' : (entry.book.author ?? 'Lendo')}
                </Text>
                {progress.totalPages > 0 ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      marginTop: 6,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <ProgressBar
                        percent={progress.percent}
                        size="sm"
                        accessibilityLabel={`Progresso: ${progress.percent}%`}
                      />
                    </View>
                    <Text variant="labelSm">{progress.percent}%</Text>
                  </View>
                ) : (
                  <Text variant="bodySm" color="accentText">
                    Página {progress.currentPage}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </HorizontalRow>
    </LibrarySection>
  );
}

const FAN = [
  { left: -14, bottom: -26, rotate: '-14deg' },
  { left: 36, bottom: -14, rotate: '-3deg' },
  { left: 92, bottom: -22, rotate: '6deg' },
] as const;

function CollectionCard({
  title,
  subtitle,
  face,
  ink,
  muted,
  books,
  onPress,
}: {
  title: string;
  subtitle: string;
  face: keyof ColorTokens;
  ink: keyof ColorTokens;
  muted: keyof ColorTokens;
  books: readonly ShelfEntry[];
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 176,
        height: 208,
        borderRadius: 22,
        overflow: 'hidden',
        padding: theme.spacing.lg,
        backgroundColor: theme.colors[face],
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        variant="heading"
        color={ink}
        numberOfLines={2}
        style={{ fontSize: 22, lineHeight: 26, letterSpacing: -0.6 }}
      >
        {title}
      </Text>
      <Text variant="bodySm" color={muted} style={{ marginTop: theme.spacing.xs }}>
        {subtitle}
      </Text>
      {books.slice(0, 3).map((entry, index) => {
        const spot = FAN[books.length === 1 ? 1 : index] ?? FAN[0];
        return (
          <View
            key={entry.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spot.left + (books.length === 1 ? 4 : 0),
              bottom: spot.bottom,
              transform: [{ rotate: spot.rotate }],
            }}
          >
            <BookCover
              title={entry.book.title}
              author={entry.book.author}
              coverUrls={entry.book.coverUrls}
              width={80}
            />
          </View>
        );
      })}
    </Pressable>
  );
}

/** Collections built from the shelf: this year's reads, Quero ler and Favoritos. */
export function Collections({ entries }: { entries: readonly ShelfEntry[] }) {
  const router = useRouter();
  const year = new Date().getFullYear();
  const read = finishedInYear(entries, year);
  const want = entries.filter((entry) => entry.status === 'want_to_read');
  const short = want.filter(
    (entry) => entry.book.totalPages !== null && entry.book.totalPages <= SHORT_BOOK_PAGES,
  ).length;
  const favorites = entries.filter((entry) => entry.favorite);
  const plural = (n: number) => `${n} ${n === 1 ? 'livro' : 'livros'}`;
  const cards = [
    read.books.length > 0 ? (
      <CollectionCard
        key="year"
        title={`Lidos em ${year}`}
        subtitle={`${plural(read.books.length)} · ${read.pages.toLocaleString('pt-BR')} páginas`}
        face="gold"
        ink="onAccentTile"
        muted="onAccentTile"
        books={read.books}
        onPress={() => openShelf(router, 'finished', year)}
      />
    ) : null,
    want.length > 0 ? (
      <CollectionCard
        key="want"
        title="Quero ler"
        subtitle={`${plural(want.length)}${short > 0 ? ` · ${short} ${short === 1 ? 'curtinho' : 'curtinhos'}` : ''}`}
        face="border"
        ink="text"
        muted="textMuted"
        books={want}
        onPress={() => openShelf(router, 'want_to_read')}
      />
    ) : null,
    favorites.length > 0 ? (
      <CollectionCard
        key="fav"
        title="Favoritos"
        subtitle={`${plural(favorites.length)} que você amou`}
        face="blueSoft"
        ink="text"
        muted="textMuted"
        books={favorites}
        onPress={() => openShelf(router, 'favorite')}
      />
    ) : null,
  ].filter(Boolean);
  if (cards.length === 0) return null;
  return (
    <LibrarySection title="Suas coleções" link="Ver todas" onLink={() => openShelf(router, 'all')}>
      <HorizontalRow>{cards}</HorizontalRow>
    </LibrarySection>
  );
}

/** The latest books put on the shelf, as big covers. */
export function RecentlyAdded({ entries }: { entries: readonly ShelfEntry[] }) {
  const theme = useTheme();
  const router = useRouter();
  const recent = [...entries]
    .sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''))
    .slice(0, 8);
  if (recent.length === 0) return null;
  return (
    <LibrarySection
      title="Adicionados recentemente"
      link="Ver todos"
      onLink={() => openShelf(router, 'all')}
    >
      <HorizontalRow>
        {recent.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            accessibilityLabel={`${entry.book.title}${entry.book.author ? `, ${entry.book.author}` : ''}`}
            accessibilityHint="Abre o livro"
            onPress={() => {
              haptics.selection();
              router.push({ pathname: '/livro/[id]', params: { id: entry.id } });
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Raised
              faceColor={theme.colors.surface}
              borderColor={theme.colors.borderSoft}
              rimColor={theme.colors.cardShadow}
              radius={22}
              depth={theme.sizes.cardRim}
              faceStyle={{ padding: 10, overflow: 'hidden' }}
            >
              <BookCover
                title={entry.book.title}
                author={entry.book.author}
                coverUrls={entry.book.coverUrls}
                width={150}
              />
            </Raised>
          </Pressable>
        ))}
      </HorizontalRow>
    </LibrarySection>
  );
}
