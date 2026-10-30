import { type ReplayResponse } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import {
  ActionRow,
  BookCover,
  Button,
  Card,
  EmptyState,
  FormScreen,
  InlineMessage,
  SectionHeader,
  Text,
} from '../design-system';
import {
  chapterLabels,
  periodLabel,
  replayChapters,
  replayMonthIsFuture,
  replaySnapshotLabel,
  shortMonth,
  storyNumber,
  type ReplayChapter,
} from '../features/replay/model';
import { useReplay } from '../features/replay/queries';
import { StoryPreview } from '../features/replay/StoryPreview';
import { StoryStylePicker } from '../features/replay/StoryStylePicker';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { FadeIn } from '../lib/motion';
import { type StoryStyle, useTheme } from '../theme';

const chapterStyles: Record<ReplayChapter, StoryStyle> = {
  intro: 'violet',
  pages: 'paper',
  time: 'night',
  books: 'paper',
  authors: 'violet',
  rhythm: 'night',
  highlight: 'paper',
  summary: 'violet',
};

function ReplayExperience({
  replay,
  version,
  busy,
  onBusy,
}: {
  replay: ReplayResponse;
  version: number;
  busy: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const theme = useTheme();
  const chapters = replayChapters(replay);
  const [index, setIndex] = useState(0);
  const [chosenStyle, setChosenStyle] = useState<StoryStyle | null>(null);

  const chapter = chapters[index] ?? 'intro';
  const style = chosenStyle ?? chapterStyles[chapter];
  const choose = (next: number) => {
    if (!busy) {
      haptics.selection();
      setIndex(next);
    }
  };
  if (!chapters.length)
    return (
      <EmptyState
        mascot="emptyShelf"
        title="Sua história começa com uma leitura"
        description="Não há sessões de leitura registradas neste período. Escolha outro período ou registre sua próxima leitura. Seu Replay vai nascer das suas leituras reais."
      />
    );
  return (
    <>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Capítulo ${index + 1} de ${chapters.length}: ${chapterLabels[chapter]}`}
        accessibilityValue={{ min: 1, max: chapters.length, now: index + 1 }}
        style={{ flexDirection: 'row', gap: 5 }}
      >
        {chapters.map((item, i) => (
          <View
            key={item}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              backgroundColor: i <= index ? theme.colors.primary : theme.colors.border,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Button
          label="Capítulo anterior"
          icon="chevron-left"
          iconOnly
          variant="secondary"
          size="md"
          disabled={index === 0 || busy}
          onPress={() => choose(index - 1)}
        />
        <View style={{ flex: 1 }}>
          <Text variant="label" align="center" accessibilityLiveRegion="polite">
            {chapterLabels[chapter]}
          </Text>
          <Text variant="bodySm" color="textMuted" align="center">
            {index + 1} de {chapters.length}
          </Text>
        </View>
        <Button
          label="Próximo capítulo"
          icon="chevron-right"
          iconOnly
          variant="secondary"
          size="md"
          disabled={index === chapters.length - 1 || busy}
          onPress={() => choose(index + 1)}
        />
      </View>
      <FadeIn key={`${chapter}|${style}|${version}`}>
        <StoryPreview content={{ kind: 'replay', replay, chapter }} style={style} onBusy={onBusy} />
      </FadeIn>
      <StoryStylePicker value={style} disabled={busy} onChange={setChosenStyle} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.xs }}
      >
        {chapters.map((item, i) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityLabel={`Ver ${chapterLabels[item]}`}
            accessibilityState={{ selected: index === i, disabled: busy }}
            disabled={busy}
            onPress={() => choose(i)}
            style={{
              minHeight: 48,
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radii.pill,
              backgroundColor: index === i ? theme.colors.primarySoft : theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text variant="label" color={index === i ? 'accentText' : 'textMuted'}>
              {chapterLabels[item]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ReplayReport replay={replay} />
    </>
  );
}

function ReplayReport({ replay }: { replay: ReplayResponse }) {
  const theme = useTheme();
  const router = useRouter();
  const [limit, setLimit] = useState(20);
  const total = replay.totals;
  const longest = replay.books.find(
    (b) => b.shelfEntryId === replay.highlights.longestSession?.shelfEntryId,
  );
  const longestBook = replay.books.find(
    (b) => b.shelfEntryId === replay.highlights.longestBook?.shelfEntryId,
  );
  const items = [
    { value: total.booksRead, label: 'livros com leitura' },
    { value: total.booksStarted, label: 'primeiras sessões em livros' },
    { value: total.booksFinished, label: 'conclusões registradas' },
    { value: total.pagesRead, label: 'páginas lidas' },
    { value: total.focusedMinutes, label: 'minutos de foco' },
    { value: total.sessionsCount, label: 'sessões' },
    { value: total.readingDays, label: 'dias com leitura' },
    { value: total.bestStreakDays, label: 'dias na melhor sequência' },
  ];
  return (
    <>
      <SectionHeader title="Sua história em detalhes" icon="auto-stories" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {items.map((item) => (
          <View
            key={item.label}
            style={{
              width: '48%',
              padding: theme.spacing.md,
              gap: 2,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderColor: theme.colors.borderSoft,
            }}
          >
            <Text variant="display" color="accentText">
              {storyNumber(item.value)}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {item.label}
            </Text>
          </View>
        ))}
      </View>
      <Card>
        <SectionHeader title="Livros da sua jornada" icon="menu-book" />
        {replay.books.slice(0, limit).map((item) => (
          <Pressable
            key={item.shelfEntryId}
            accessibilityRole="button"
            accessibilityLabel={`Ver ${item.book.title}, ${item.pagesRead} páginas em ${item.sessionsCount} sessões`}
            onPress={() =>
              router.push({ pathname: '/livro/[id]', params: { id: item.shelfEntryId } })
            }
            style={{
              flexDirection: 'row',
              gap: theme.spacing.md,
              minHeight: 72,
              alignItems: 'center',
              paddingVertical: theme.spacing.sm,
            }}
          >
            <BookCover
              title={item.book.title}
              author={item.book.author}
              coverUrls={item.book.coverUrls}
              width={44}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label">{item.book.title}</Text>
              {item.book.author ? (
                <Text variant="bodySm" color="textMuted">
                  {item.book.author}
                </Text>
              ) : null}
              <Text variant="bodySm" color="textMuted">
                {storyNumber(item.pagesRead)} páginas · {Math.floor(item.focusedSeconds / 60)} min ·{' '}
                {item.sessionsCount} sessões
              </Text>
              {item.startedInPeriod || item.finishedInPeriod ? (
                <Text variant="bodySm" color="accentText">
                  {[
                    item.startedInPeriod ? 'Primeira sessão no período' : null,
                    item.finishedInPeriod ? 'Conclusão registrada' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
        {replay.books.length > limit ? (
          <Button
            label="Ver mais livros"
            variant="secondary"
            size="md"
            onPress={() => setLimit((n) => n + 20)}
          />
        ) : null}
      </Card>
      {replay.topAuthors.length ? (
        <Card>
          <SectionHeader title="Autores mais presentes" icon="edit-note" />
          {replay.topAuthors.map((author, i) => (
            <View
              key={author.author}
              style={{
                flexDirection: 'row',
                gap: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
              }}
            >
              <Text variant="heading" color="accentText" style={{ minWidth: 28 }}>
                {i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="label">{author.author}</Text>
                <Text variant="bodySm" color="textMuted">
                  {author.booksRead} livros · {storyNumber(author.pagesRead)} páginas ·{' '}
                  {Math.floor(author.focusedSeconds / 60)} min
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      {replay.period.kind === 'year' ? (
        <Card>
          <SectionHeader title="Seu ano, mês a mês" icon="calendar-month" />
          {replay.months.map((month) => (
            <View key={month.month} style={{ gap: 6, paddingVertical: theme.spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <Text variant="label" style={{ textTransform: 'capitalize' }}>
                  {shortMonth(month.month)}
                </Text>
                <Text variant="bodySm" color="textMuted">
                  {replayMonthIsFuture(replay.period, month.month, new Date())
                    ? 'Ainda não aconteceu'
                    : `${month.booksRead} livros · ${month.pagesRead} págs. · ${Math.floor(month.focusedSeconds / 60)} min`}
                </Text>
              </View>
              <View
                style={{ height: 6, backgroundColor: theme.colors.borderSoft, borderRadius: 3 }}
              >
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.colors.primary,
                    width: `${(100 * month.focusedSeconds) / Math.max(1, ...replay.months.map((m) => m.focusedSeconds))}%`,
                  }}
                />
              </View>
              <Text variant="bodySm" color="textMuted">
                {replayMonthIsFuture(replay.period, month.month, new Date())
                  ? 'Período futuro'
                  : `${month.sessionsCount} sessões · ${month.readingDays} dias · ${month.booksStarted} primeiras leituras · ${month.booksFinished} conclusões`}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
      {longest || longestBook || replay.highlights.bestMonth !== null ? (
        <Card>
          <SectionHeader title="Pequenos marcos" icon="auto-awesome" />
          {longest && replay.highlights.longestSession ? (
            <Text variant="body">
              Sua sessão mais longa:{' '}
              {Math.floor(replay.highlights.longestSession.focusedSeconds / 60)} minutos com{' '}
              {longest.book.title}.
            </Text>
          ) : null}
          {longestBook && replay.highlights.longestBook ? (
            <Text variant="body">
              A jornada mais longa até uma conclusão registrada:{' '}
              {replay.highlights.longestBook.spanDays} dias em {longestBook.book.title}.
            </Text>
          ) : null}
          {replay.period.kind === 'year' && replay.highlights.bestMonth !== null ? (
            <Text variant="body">
              Um dos meses com mais tempo de leitura: {shortMonth(replay.highlights.bestMonth)}.
            </Text>
          ) : null}
        </Card>
      ) : null}
      <Card>
        <SectionHeader title="De onde vem seu Replay" icon="info-outline" />
        <Text variant="bodySm" color="textMuted">
          Sessões de leitura salvas no Bubo, com dados consultados em{' '}
          {new Date(replay.generatedAt).toLocaleDateString('pt-BR', {
            timeZone: replay.period.timeZone,
          })}
          , agrupadas no fuso {replay.period.timeZone}. Páginas são os avanços registrados; minutos
          somam o tempo de foco. Revisões e dias protegidos não entram na sequência de leitura.
        </Text>
        <Text variant="bodySm" color="textMuted">
          “Primeira sessão” usa o primeiro registro disponível do livro. “Conclusão registrada”
          exige uma sessão que alcance o total de páginas conhecido hoje. Marcar Já li na estante
          não cria uma conclusão na retrospectiva.
        </Text>
        <Text variant="bodySm" color="textMuted">
          Gêneros, citações e Pontes aparecerão quando houver dados próprios para eles. Suas
          reflexões e respostas privadas ficam fora das artes.
        </Text>
        <ActionRow
          title="Compartilhar um livro"
          subtitle="Escolha um livro na Estante e toque em Compartilhar livro"
          icon="ios-share"
          onPress={() => router.push('/(tabs)/estante')}
        />
      </Card>
    </>
  );
}

export default function ReplayScreen() {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const now = new Date();
  const [kind, setKind] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const query = useReplay(userId, { kind, year, ...(kind === 'month' ? { month } : {}), timeZone });
  const future =
    kind === 'year'
      ? year >= now.getFullYear()
      : year * 12 + month >= now.getFullYear() * 12 + now.getMonth() + 1;
  function move(direction: -1 | 1) {
    haptics.selection();
    if (kind === 'year') setYear((n) => n + direction);
    else {
      const date = new Date(year, month - 1 + direction, 1);
      setYear(date.getFullYear());
      setMonth(date.getMonth() + 1);
    }
  }
  const label = periodLabel({
    kind,
    year,
    month: kind === 'month' ? month : null,
    timeZone,
    startDate: '',
    endDate: '',
    inProgress: false,
  });
  return (
    <FormScreen title="Bubo Replay">
      <Text variant="display">Você leu.{'\n'}Vale guardar.</Text>
      <Text variant="body" color="textMuted">
        As páginas, as vozes e o tempo que fizeram parte da sua história. Para rever e compartilhar
        do seu jeito.
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {(
          [
            { id: 'month', label: 'Meu mês' },
            { id: 'year', label: 'Meu ano' },
          ] as const
        ).map((option) => (
          <Button
            key={option.id}
            label={option.label}
            size="md"
            variant={kind === option.id ? 'primary' : 'secondary'}
            style={{ flex: 1 }}
            disabled={busy}
            onPress={() => {
              haptics.selection();
              if (option.id === 'month' && year === now.getFullYear() && month > now.getMonth() + 1)
                setMonth(now.getMonth() + 1);
              setKind(option.id);
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Button
          label="Período anterior"
          icon="chevron-left"
          iconOnly
          size="md"
          variant="secondary"
          disabled={busy || (year <= 2020 && (kind === 'year' || month === 1))}
          onPress={() => move(-1)}
        />
        <Text variant="titleSm" align="center" style={{ flex: 1, textTransform: 'capitalize' }}>
          {label}
        </Text>
        <Button
          label="Próximo período"
          icon="chevron-right"
          iconOnly
          size="md"
          variant="secondary"
          disabled={busy || future}
          onPress={() => move(1)}
        />
      </View>
      {query.fetchStatus === 'paused' && !query.data ? (
        <EmptyState
          mascot="offline"
          title="Vamos preparar seu Replay quando você se conectar"
          description="Precisamos consultar suas leituras para montar a retrospectiva. Conecte o celular e tente novamente."
          action={
            <Button label="Tentar novamente" icon="refresh" onPress={() => void query.refetch()} />
          }
        />
      ) : !userId || query.isPending ? (
        <ActivityIndicator
          accessibilityLabel="Preparando seu Replay"
          color={theme.colors.primary}
        />
      ) : query.isError || !query.data ? (
        <EmptyState
          mascot="offline"
          title="Seu Replay está esperando por você"
          description="Não conseguimos carregar suas leituras agora. Tente novamente para preparar a retrospectiva."
          action={
            <Button
              label="Tentar novamente"
              icon="refresh"
              loading={query.isFetching}
              onPress={() => void query.refetch()}
            />
          }
        />
      ) : (
        <>
          {query.data.period.inProgress ? (
            <InlineMessage
              tone="info"
              message={`Esta edição reúne as leituras registradas até ${replaySnapshotLabel(query.data)}. Atualize ao voltar para ver novas leituras.`}
            />
          ) : null}
          {query.data.coverage.partialHistory ? (
            <Text variant="bodySm" color="textMuted">
              Histórico parcial:{' '}
              {query.data.coverage.firstSessionDate
                ? `seu primeiro registro disponível é de ${query.data.coverage.firstSessionDate.split('-').reverse().join('/')}`
                : 'ainda não há leituras registradas'}
              .
            </Text>
          ) : null}
          <ReplayExperience
            key={`${userId}|${kind}|${year}|${month}|${timeZone}`}
            replay={query.data}
            version={query.dataUpdatedAt}
            busy={busy}
            onBusy={setBusy}
          />
        </>
      )}
    </FormScreen>
  );
}
