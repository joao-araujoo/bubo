import { type Book, type ReplayResponse } from '@bubo/contracts';
import { computeReplay, createReplayPeriod } from '@bubo/domain';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { buboMascots, mascotLabels, type MascotPose } from '../../assets/registry';
import {
  Book3D,
  BuboLogo,
  BuboMascot,
  Button,
  Card,
  Chip,
  ProgressBar,
  SectionHeader,
  Text,
  WeekStrip,
} from '../../design-system';
import { useApiHealth } from '../../lib/api/queries';
import { StoryPreview } from '../../features/replay/StoryPreview';
import { StoryStylePicker } from '../../features/replay/StoryStylePicker';
import { replayChapters, type StoryContent } from '../../features/replay/model';
import { type StoryStyle } from '../../theme';
import { type ColorTokens, type TypographyVariant, typography, useTheme } from '../../theme';

/**
 * DEV-only design-system showcase. Everything here is sample UI for visual QA — it is never
 * reachable in production builds (redirects to Hoje) and never feeds real screens.
 */
const SWATCHES: (keyof ColorTokens)[] = [
  'primary',
  'primaryPressed',
  'purpleLight',
  'bg',
  'surface',
  'surfaceMuted',
  'text',
  'textMuted',
  'border',
  'success',
  'warning',
  'error',
  'gold',
  'orange',
];

const SAMPLE_WEEK = [
  { isoDate: 'd1', label: 'SEG', state: 'done' },
  { isoDate: 'd2', label: 'TER', state: 'done' },
  { isoDate: 'd3', label: 'QUA', state: 'missed' },
  { isoDate: 'd4', label: 'QUI', state: 'done' },
  { isoDate: 'd5', label: 'SEX', state: 'today' },
  { isoDate: 'd6', label: 'SÁB', state: 'future' },
  { isoDate: 'd7', label: 'DOM', state: 'future' },
] as const;

function ApiStatus() {
  const health = useApiHealth();
  const label = health.isPending
    ? 'Verificando API…'
    : health.isError
      ? `API indisponível (${health.error instanceof Error ? health.error.message : 'erro'})`
      : `API ok · ${health.data.service} ${health.data.version} · ${health.data.environment}`;
  return (
    <Chip
      label={label}
      tone={health.isError ? 'orange' : health.isSuccess ? 'success' : 'neutral'}
      icon={health.isError ? 'cloud-off' : 'cloud-done'}
    />
  );
}

/** Fictional activity is confined to this DEV route for long-copy, cover and capture QA. */
function StoryShowcase() {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [style, setStyle] = useState<StoryStyle>('paper');
  const [busy, setBusy] = useState(false);
  const now = new Date('2026-10-04T15:00:00Z');
  const sampleTitles = [
    'Dom Casmurro',
    'Duna',
    'A hora da estrela',
    'O pequeno príncipe',
    'Memórias póstumas de Brás Cubas',
    'Ensaio sobre a cegueira',
  ];
  const sampleAuthors = [
    'Machado de Assis',
    'Frank Herbert',
    'Clarice Lispector',
    'Antoine de Saint-Exupéry',
    'Machado de Assis',
    'José Saramago',
  ];
  const books: Book[] = sampleTitles.map((title, i) => ({
    id: `dev-book-${i}`,
    title,
    author: sampleAuthors[i] ?? null,
    totalPages: 200,
    catalogId: null,
    isbn13: null,
    publisher: null,
    publishedYear: null,
    coverUrls: i === 1 ? ['https://covers.openlibrary.org/b/isbn/9788576573135-L.jpg'] : [],
  }));
  const readings = books.flatMap((book, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      id: `dev-session-${i}-${j}`,
      shelfEntryId: book.id,
      startedAt: new Date(`2026-09-${String(i * 3 + j + 1).padStart(2, '0')}T21:00:00Z`),
      endedAt: new Date(`2026-09-${String(i * 3 + j + 1).padStart(2, '0')}T21:30:00Z`),
      focusedSeconds: 1800,
      startPage: j * 70,
      endPage: (j + 1) * 70,
    })),
  );
  const replay: ReplayResponse = computeReplay({
    period: createReplayPeriod({ kind: 'year', year: 2026, timeZone: 'America/Sao_Paulo' }, now),
    now,
    firstSessionAt: readings[0]?.endedAt ?? null,
    sessions: readings,
    books: books.map((book) => ({
      shelfEntryId: book.id,
      book,
      author: book.author,
      firstReadAt: readings.find((s) => s.shelfEntryId === book.id)?.endedAt ?? now,
      lastReadAt: readings.filter((s) => s.shelfEntryId === book.id).at(-1)?.endedAt ?? now,
      completionAt: null,
    })),
  });
  const longBook: Book = {
    ...books[0]!,
    id: 'dev-long',
    title:
      'Um título de livro muito longo para conferir o equilíbrio, a leitura e o tamanho da tipografia na arte compartilhável',
    author: 'Uma autoria extensa, com nome e sobrenome, que também precisa continuar legível',
  };
  const longAuthors = {
    ...replay,
    topAuthors: replay.topAuthors.slice(0, 3).map((a, i) => ({
      ...a,
      author: `Uma autoria de nome muito extenso para conferir duas linhas ${i + 1}`,
    })),
  };
  const contents: StoryContent[] = [
    { kind: 'book', book: books[1]!, status: 'reading', rating: 4 },
    { kind: 'book', book: longBook, status: 'finished', rating: 5 },
    ...replayChapters(replay).map((chapter): StoryContent => ({ kind: 'replay', replay, chapter })),
    { kind: 'replay', replay: longAuthors, chapter: 'authors' },
  ];
  const content = contents[index] ?? contents[0]!;
  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionHeader title="Stories · amostra DEV" icon="ios-share" />
      <Text variant="bodySm" color="textMuted">
        Atividade fictícia, só para conferir as artes. Caso {index + 1}/{contents.length}.
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          label="Anterior"
          size="md"
          variant="secondary"
          disabled={busy || index === 0}
          onPress={() => setIndex((n) => n - 1)}
          style={{ flex: 1 }}
        />
        <Button
          label="Próximo"
          size="md"
          variant="secondary"
          disabled={busy || index === contents.length - 1}
          onPress={() => setIndex((n) => n + 1)}
          style={{ flex: 1 }}
        />
      </View>
      <StoryStylePicker value={style} onChange={setStyle} disabled={busy} />
      <StoryPreview key={`${index}|${style}`} content={content} style={style} onBusy={setBusy} />
    </View>
  );
}

export default function ShowcaseScreen() {
  const theme = useTheme();
  const { stories } = useLocalSearchParams<{ stories?: string }>();
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={{
        padding: theme.sizes.gutter,
        gap: theme.spacing.lg,
        paddingBottom: theme.spacing.xxxl,
      }}
    >
      {stories === '1' ? <StoryShowcase /> : null}
      <Card>
        <SectionHeader title="Sistema" icon="dns" />
        <ApiStatus />
      </Card>

      <Card>
        <SectionHeader title="Marca" icon="verified" />
        <BuboLogo height={40} />
        <BuboLogo variant="symbol" height={56} />
      </Card>

      <Card>
        <SectionHeader title="Cores" icon="palette" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {SWATCHES.map((token) => (
            <View key={token} style={{ width: 96, gap: theme.spacing.xxs }}>
              <View
                style={{
                  height: 40,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors[token],
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              />
              <Text variant="bodySm" color="textMuted">
                {token}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Livro 3D (amostra)" icon="menu-book" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xl }}>
          <Book3D title="Capa tipográfica" author="Autor de exemplo" totalPages={120} width={120} />
          <Book3D title="Um livro longo" author="Autor de exemplo" totalPages={900} width={120} />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Tipografia" icon="text-fields" />
        {(Object.keys(typography) as TypographyVariant[]).map((variant) => (
          <Text key={variant} variant={variant}>
            {variant} · Leia com profundidade
          </Text>
        ))}
      </Card>

      <Card>
        <SectionHeader title="Botões" icon="smart-button" />
        <Button label="Continuar leitura" icon="play-arrow" fullWidth />
        <Button
          label="Revisar agora"
          variant="success"
          fullWidth
          trailing={<Chip label="+25 XP" tone="gold" />}
        />
        <Button label="Atualizar" variant="secondary" size="md" icon="add" />
        <Button label="Carregando" loading fullWidth />
        <Button label="Desabilitado" disabled fullWidth />
      </Card>

      <Card>
        <SectionHeader
          title="Chips, progresso e semana (amostra)"
          icon="tune"
          trailing={<Chip label="+20 XP" tone="gold" />}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip label="Lendo agora" eyebrow />
          <Chip label="7" tone="orange" icon="local-fire-department" iconColor="orange" />
          <Chip label="340" tone="gold" icon="star" iconColor="goldRim" />
          <Chip label="3 cards pendentes" tone="neutral" icon="style" />
        </View>
        <ProgressBar percent={41} accessibilityLabel="Progresso de amostra: 41%" />
        <WeekStrip days={[...SAMPLE_WEEK]} />
      </Card>

      <Card>
        <SectionHeader title="Mascote oficial (todas as poses)" icon="pets" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {(Object.keys(buboMascots) as MascotPose[]).map((pose) => (
            <View key={pose} style={{ width: 96, alignItems: 'center', gap: theme.spacing.xxs }}>
              <BuboMascot pose={pose} size={88} decorative={false} />
              <Text variant="bodySm" color="textMuted" align="center" numberOfLines={2}>
                {pose}
              </Text>
              <Text
                variant="caption"
                color="textMuted"
                align="center"
                numberOfLines={2}
                style={{ textTransform: 'none' }}
              >
                {mascotLabels[pose]}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
