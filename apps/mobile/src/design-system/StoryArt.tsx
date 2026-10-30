import { type Book } from '@bubo/contracts';
import { coverUrlForWidth, stableBucket } from '@bubo/domain';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  bookStoryLabels,
  periodLabel,
  shortMonth,
  storyBooks,
  storyNumber,
  replaySnapshotLabel,
  type StoryContent,
} from '../features/replay/model';
import {
  coverPalettes,
  palette,
  storyLayout,
  storyThemes,
  storyType,
  type StoryStyle,
} from '../theme';
import { BuboLogo } from './BuboLogo';
import { Icon } from './Icon';
import { Text } from './Text';

type ArtTheme = (typeof storyThemes)[StoryStyle];

function ArtText({
  children,
  theme,
  type = 'body',
  muted = false,
  lines,
  center = false,
}: {
  children: ReactNode;
  theme: ArtTheme;
  type?: keyof typeof storyType;
  muted?: boolean;
  lines?: number;
  center?: boolean;
}) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={lines}
      adjustsFontSizeToFit
      minimumFontScale={0.65}
      style={[
        storyType[type],
        { color: muted ? theme.muted : theme.ink, textAlign: center ? 'center' : 'left' },
      ]}
    >
      {children}
    </Text>
  );
}

/** Always asks for the full cover rendition; the preview must not export a thumbnail. */
function ArtCover({
  book,
  width,
  onReady,
}: {
  book: Book;
  width: number;
  onReady: (id: string) => void;
}) {
  const candidates = [...new Set(book.coverUrls.map((url) => coverUrlForWidth(url, 1080)))];
  const [index, setIndex] = useState(0);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const source = candidates[index];
  const loaded = source === loadedSource;
  const fallback =
    coverPalettes[stableBucket(book.title, coverPalettes.length)] ?? coverPalettes[0];
  useEffect(() => {
    if (!source || loaded) {
      onReady(book.id);
      return;
    }
    const timer = setTimeout(() => setIndex((n) => (n === index ? n + 1 : n)), 6_000);
    return () => clearTimeout(timer);
  }, [source, loaded, onReady, index, book.id]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Capa de ${book.title}`}
      style={{
        width,
        height: width * 1.5,
        borderRadius: 5,
        overflow: 'hidden',
        backgroundColor: fallback?.face,
      }}
    >
      {source ? (
        <Image
          key={source}
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          onError={() => setIndex((n) => (n === index ? n + 1 : n))}
          onLoad={(event) => {
            if (event.source.width < 20 || event.source.height < 20)
              setIndex((n) => (n === index ? n + 1 : n));
          }}
          onDisplay={() => setLoadedSource(source)}
        />
      ) : (
        <View style={{ flex: 1, padding: width * 0.1, justifyContent: 'space-between' }}>
          {book.author ? (
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[
                storyType.small,
                { color: fallback?.muted, fontSize: Math.max(7, width / 15) },
              ]}
            >
              {book.author}
            </Text>
          ) : (
            <View />
          )}
          <Text
            allowFontScaling={false}
            numberOfLines={5}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[
              storyType.bookTitle,
              { color: fallback?.text, fontSize: width / 7, lineHeight: width / 5.7 },
            ]}
          >
            {book.title}
          </Text>
          <View style={{ height: 3, width: width / 4, backgroundColor: fallback?.accent }} />
        </View>
      )}
    </View>
  );
}

function Motif({ theme, subtle = false }: { theme: ArtTheme; subtle?: boolean }) {
  return (
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: 'absolute',
          width: 430,
          height: 430,
          borderRadius: 215,
          top: 176,
          left: -180,
          borderWidth: 40,
          borderColor: theme.decoration,
          opacity: subtle ? 0.45 : 1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 240,
          height: 240,
          borderRadius: 120,
          top: -135,
          right: -72,
          backgroundColor: theme.accent,
          opacity: 0.22,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 90,
          height: 270,
          borderRadius: 45,
          bottom: -138,
          right: 18,
          transform: [{ rotate: '35deg' }],
          backgroundColor: theme.accent,
          opacity: 0.24,
        }}
      />
    </View>
  );
}

function Metric({ value, label, theme }: { value: number; label: string; theme: ArtTheme }) {
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <ArtText theme={theme} type="metric" lines={1}>
        {storyNumber(value)}
      </ArtText>
      <ArtText theme={theme} type="small" muted>
        {label}
      </ArtText>
    </View>
  );
}

/** Static art shared by preview and PNG capture. Controls and animations live outside this view. */
export function StoryArt({
  content,
  style = 'paper',
  onReady,
}: {
  content: StoryContent;
  style?: StoryStyle;
  onReady: () => void;
}) {
  const theme = storyThemes[style];
  const books = storyBooks(content);
  const [ready, setReady] = useState<ReadonlySet<string>>(new Set());
  // Stable so a sibling cover finishing never restarts another cover's stall timer.
  const markReady = useCallback(
    (id: string) => setReady((old) => (old.has(id) ? old : new Set([...old, id]))),
    [],
  );
  const markBrandReady = useCallback(() => markReady('brand'), [markReady]);
  const complete = ready.has('brand') && books.every((b) => ready.has(b.id));
  useEffect(() => {
    if (complete) onReady();
  }, [complete, onReady]);
  // The official lockup has dark ink, so dark styles keep it on a small white plate.
  const brand = (
    <View
      style={
        style === 'paper'
          ? undefined
          : {
              backgroundColor: palette.white,
              paddingHorizontal: 9,
              paddingVertical: 6,
              borderRadius: 8,
            }
      }
    >
      <BuboLogo height={storyLayout.logoHeight} onLoad={markBrandReady} />
    </View>
  );
  const cover = (book: Book, width: number) => (
    <ArtCover key={book.id} book={book} width={width} onReady={markReady} />
  );

  return (
    <View
      style={{
        width: storyLayout.width,
        height: storyLayout.height,
        overflow: 'hidden',
        backgroundColor: theme.background,
      }}
    >
      <Motif theme={theme} subtle={content.kind === 'book'} />
      {content.kind === 'book' ? (
        <View
          style={{
            position: 'absolute',
            top: storyLayout.safeTop,
            left: storyLayout.gutter,
            right: storyLayout.gutter,
            alignItems: 'center',
          }}
        >
          <ArtText theme={theme} type="eyebrow" center>
            {bookStoryLabels[content.status]}
          </ArtText>
          <View style={{ marginTop: 14 }}>{cover(content.book, 180)}</View>
          <View style={{ marginTop: 18, gap: 2, alignSelf: 'stretch' }}>
            <ArtText theme={theme} type="bookTitle" lines={2} center>
              {content.book.title}
            </ArtText>
            {content.book.author ? (
              <ArtText theme={theme} muted lines={1} center>
                {content.book.author}
              </ArtText>
            ) : null}
          </View>
          {content.rating ? (
            <View
              accessible
              accessibilityLabel={`Nota: ${content.rating} de 5`}
              style={{ flexDirection: 'row', gap: 2, marginTop: 8 }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon
                  key={n}
                  name={n <= (content.rating ?? 0) ? 'star' : 'star-border'}
                  size={15}
                  color="gold"
                />
              ))}
            </View>
          ) : null}
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 44, height: 1, backgroundColor: theme.muted, opacity: 0.5 }} />
            <ArtText theme={theme} type="eyebrow" muted>
              NO
            </ArtText>
            <View style={{ width: 44, height: 1, backgroundColor: theme.muted, opacity: 0.5 }} />
          </View>
          <View style={{ marginTop: 6 }}>{brand}</View>
        </View>
      ) : (
        <>
          <ReplayArt content={content} theme={theme} cover={cover} />
          <View style={{ position: 'absolute', top: 532, left: 0, right: 0, alignItems: 'center' }}>
            {brand}
          </View>
        </>
      )}
    </View>
  );
}

function ReplayArt({
  content,
  theme,
  cover,
}: {
  content: Extract<StoryContent, { kind: 'replay' }>;
  theme: ArtTheme;
  cover: (book: Book, width: number) => ReactNode;
}) {
  const { replay, chapter } = content;
  const total = replay.totals;
  const label = periodLabel(replay.period);
  const highlight = replay.books.find((b) => b.shelfEntryId === replay.highlights.mostReadBookId);
  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: 85,
          left: 30,
          right: 30,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <ArtText theme={theme} type="eyebrow">
          BUBO REPLAY
        </ArtText>
        <ArtText theme={theme} type="small" muted>
          {label}
          {replay.period.inProgress ? ` · até ${replaySnapshotLabel(replay)}` : ''}
        </ArtText>
      </View>
      <View style={{ position: 'absolute', top: 117, left: 30, right: 30, bottom: 129, gap: 14 }}>
        {chapter === 'intro' ? (
          <>
            <ArtText theme={theme} type="title">
              Eu li.{'\n'}Eu vivi.
            </ArtText>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 12,
                marginVertical: 5,
              }}
            >
              {replay.books.slice(0, 3).map((b, i) => (
                <View
                  key={b.shelfEntryId}
                  style={{
                    transform: [{ rotate: `${(i - 1) * 7}deg` }],
                    marginBottom: i === 1 ? 8 : 0,
                  }}
                >
                  {cover(b.book, 72)}
                </View>
              ))}
            </View>
            <ArtText theme={theme} type="bookTitle">
              {replay.period.kind === 'year' ? 'Meu ano em livros.' : 'Meu mês em livros.'}
            </ArtText>
            <ArtText theme={theme} muted>
              {storyNumber(total.booksRead)} livros na jornada. {storyNumber(total.readingDays)}{' '}
              dias de leitura.
            </ArtText>
          </>
        ) : null}
        {chapter === 'pages' ? (
          <>
            <ArtText theme={theme} type="title">
              Uma página.{'\n'}Outro mundo.
            </ArtText>
            <View style={{ marginTop: 27, marginBottom: 10 }}>
              <ArtText theme={theme} type="number" lines={1}>
                {storyNumber(total.pagesRead)}
              </ArtText>
              <ArtText theme={theme} type="bookTitle">
                páginas lidas
              </ArtText>
            </View>
            <View
              style={{ height: 2, backgroundColor: theme.accent, width: 62, marginVertical: 12 }}
            />
            <ArtText theme={theme} muted>
              Nas minhas sessões de leitura.{'\n'}Cada página, parte da minha história.
            </ArtText>
          </>
        ) : null}
        {chapter === 'time' ? (
          <>
            <ArtText theme={theme} type="title">
              Tempo para{'\n'}me perder{'\n'}num livro.
            </ArtText>
            <View style={{ marginTop: 12 }}>
              <ArtText theme={theme} type="number" lines={1}>
                {storyNumber(total.focusedMinutes)}
              </ArtText>
              <ArtText theme={theme} type="bookTitle">
                minutos de leitura
              </ArtText>
            </View>
            <View style={{ flexDirection: 'row', gap: 20, marginTop: 18 }}>
              <Metric value={total.sessionsCount} label="sessões de foco" theme={theme} />
              <Metric value={total.readingDays} label="dias com leitura" theme={theme} />
            </View>
          </>
        ) : null}
        {chapter === 'books' ? (
          <>
            <ArtText theme={theme} type="bookTitle">
              Minha estante{'\n'}ganhou vida.
            </ArtText>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
                justifyContent: 'center',
                marginTop: 8,
              }}
            >
              {replay.books.slice(0, 6).map((b) => (
                <View key={b.shelfEntryId}>{cover(b.book, replay.books.length > 3 ? 67 : 90)}</View>
              ))}
            </View>
            <ArtText theme={theme} muted>
              {storyNumber(total.booksRead)} livros com leitura
              {total.booksRead > 6 ? ' · seleção de 6 capas' : ''}
            </ArtText>
            <View style={{ flexDirection: 'row', gap: 20 }}>
              <Metric value={total.booksStarted} label="primeiras sessões" theme={theme} />
              <Metric value={total.booksFinished} label="conclusões registradas" theme={theme} />
            </View>
          </>
        ) : null}
        {chapter === 'authors' ? (
          <>
            <ArtText theme={theme} type="title">
              Vozes que{'\n'}me acompanham.
            </ArtText>
            <View style={{ gap: 20, marginTop: 8 }}>
              {replay.topAuthors.slice(0, 3).map((author, i) => (
                <View key={author.author} style={{ flexDirection: 'row', gap: 14 }}>
                  <Text
                    allowFontScaling={false}
                    style={[storyType.metric, { color: theme.accent, width: 30 }]}
                  >
                    {i + 1}
                  </Text>
                  <View style={{ flex: 1, gap: 3 }}>
                    <ArtText theme={theme} type="bookTitle" lines={2}>
                      {author.author}
                    </ArtText>
                    <ArtText theme={theme} type="small" muted>
                      {author.booksRead} {author.booksRead === 1 ? 'livro' : 'livros'} ·{' '}
                      {storyNumber(author.pagesRead)} páginas
                    </ArtText>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
        {chapter === 'rhythm' ? (
          <>
            <ArtText theme={theme} type="title">
              No meu{'\n'}próprio ritmo.
            </ArtText>
            <View style={{ marginTop: 13 }}>
              <ArtText theme={theme} type="number" lines={1}>
                {total.readingDays}
              </ArtText>
              <ArtText theme={theme} type="bookTitle">
                dias com leitura
              </ArtText>
            </View>
            {replay.period.kind === 'year' ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 72 }}>
                {replay.months.map((m) => (
                  <View key={m.month} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                    <View
                      style={{
                        width: '100%',
                        height:
                          3 +
                          (48 * m.focusedSeconds) /
                            Math.max(1, ...replay.months.map((x) => x.focusedSeconds)),
                        borderRadius: 3,
                        backgroundColor: m.focusedSeconds ? theme.accent : theme.decoration,
                      }}
                    />
                    <Text
                      allowFontScaling={false}
                      style={[storyType.small, { color: theme.muted, fontSize: 6 }]}
                    >
                      {shortMonth(m.month)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                {Array.from({ length: total.readingDays }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: 8,
                      backgroundColor: theme.accent,
                    }}
                  />
                ))}
              </View>
            )}
            <ArtText theme={theme} muted>
              Minha melhor sequência: {total.bestStreakDays}{' '}
              {total.bestStreakDays === 1 ? 'dia' : 'dias'}.
            </ArtText>
            {replay.highlights.favoriteHour ? (
              <ArtText theme={theme} type="small" muted>
                Meu horário mais frequente: {replay.highlights.favoriteHour.hour}h.
              </ArtText>
            ) : null}
          </>
        ) : null}
        {chapter === 'highlight' && highlight ? (
          <>
            <ArtText theme={theme} type="bookTitle">
              Um dos livros{'\n'}a que mais voltei.
            </ArtText>
            <View style={{ alignSelf: 'center', marginTop: 5 }}>{cover(highlight.book, 122)}</View>
            <ArtText theme={theme} type="bookTitle" lines={2}>
              {highlight.book.title}
            </ArtText>
            <ArtText theme={theme} muted lines={1}>
              {highlight.book.author ?? 'Da minha estante'}
            </ArtText>
            <ArtText theme={theme} type="small" muted>
              {highlight.sessionsCount} sessões de leitura neste período.
            </ArtText>
          </>
        ) : null}
        {chapter === 'summary' ? (
          <>
            <ArtText theme={theme} type="title">
              Minhas leituras.{'\n'}Minha história.
            </ArtText>
            <View
              style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 6 }}
            >
              {replay.books.slice(0, 3).map((b) => (
                <View key={b.shelfEntryId}>{cover(b.book, 64)}</View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <Metric value={total.booksRead} label="livros na jornada" theme={theme} />
              <Metric value={total.pagesRead} label="páginas lidas" theme={theme} />
            </View>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <Metric value={total.focusedMinutes} label="minutos de foco" theme={theme} />
              <Metric value={total.readingDays} label="dias com leitura" theme={theme} />
            </View>
            {replay.topAuthors[0] ? (
              <ArtText theme={theme} type="small" muted lines={1}>
                Mais presente: {replay.topAuthors[0].author}
              </ArtText>
            ) : null}
          </>
        ) : null}
      </View>
      {replay.coverage.partialHistory ? (
        <View style={{ position: 'absolute', top: 514, left: 30, right: 30 }}>
          <ArtText theme={theme} type="small" muted>
            Meu histórico registrado no Bubo · período parcial.
          </ArtText>
        </View>
      ) : null}
    </>
  );
}
