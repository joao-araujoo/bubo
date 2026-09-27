import { type SessionResult, type ShelfEntry } from '@bubo/contracts';
import { MAX_REFLECTION_LENGTH, MIN_SESSION_SECONDS, toLocalIsoDate } from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import {
  BookCover,
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  InlineMessage,
  Text,
  TextField,
} from '../../design-system';
import { formatDuration, useFocusTimer } from '../../features/session/useFocusTimer';
import { ApiError } from '../../lib/api/client';
import { useRecordSession, useShelfEntry } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type Finished = { startedAt: Date; endedAt: Date; focusedSeconds: number; id: string };

/** Leaving while a session is in progress asks for confirmation (it would be lost). */
function useConfirmLeave(active: boolean) {
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!active) return;
        event.preventDefault();
        Alert.alert('Descartar esta sessão?', 'O tempo desta leitura não será salvo.', [
          { text: 'Continuar', style: 'cancel' },
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: () => navigation.dispatch(event.data.action),
          },
        ]);
      }),
    [navigation, active],
  );
}

function TimerStep({
  entry,
  onFinish,
}: {
  entry: ShelfEntry;
  onFinish: (value: Omit<Finished, 'id'>) => void;
}) {
  const theme = useTheme();
  const timer = useFocusTimer();
  const canFinish = timer.elapsedSeconds >= MIN_SESSION_SECONDS;
  const active = timer.status !== 'idle';
  useConfirmLeave(active);

  return (
    <FormScreen
      footer={
        <>
          {timer.status === 'running' ? (
            <Button
              label="Pausar"
              icon="pause"
              variant="secondary"
              fullWidth
              onPress={timer.pause}
            />
          ) : (
            <Button
              label={timer.status === 'idle' ? 'Começar a ler' : 'Retomar'}
              icon="play-arrow"
              fullWidth
              disabled={timer.reachedCap}
              onPress={timer.start}
            />
          )}
          <Button
            label="Encerrar sessão"
            icon="flag"
            variant="success"
            fullWidth
            disabled={!canFinish}
            accessibilityHint={canFinish ? undefined : 'Disponível a partir de 1 minuto de leitura'}
            onPress={() => {
              haptics.commit();
              onFinish(timer.finish());
            }}
          />
        </>
      }
    >
      <Chip label="Modo leitura profunda" eyebrow align="center" />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BookCover
          title={entry.book.title}
          author={entry.book.author}
          coverUrls={entry.book.coverUrls}
          width={52}
        />
        <View style={{ flex: 1 }}>
          <Text variant="titleSm" numberOfLines={2}>
            {entry.book.title}
          </Text>
          {entry.book.author ? (
            <Text variant="bodySm" color="textMuted">
              {entry.book.author}
            </Text>
          ) : null}
          <Text variant="bodySm" color="accentText">
            Pág. {entry.currentPage}
          </Text>
        </View>
      </Card>
      <View
        style={{ alignItems: 'center', gap: theme.spacing.md, marginVertical: theme.spacing.xl }}
      >
        <View
          style={{
            width: 248,
            height: 248,
            borderRadius: theme.radii.pill,
            borderWidth: 9,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <BuboMascot state="focusSession" size={118} />
          <Text
            variant="heading"
            align="center"
            accessibilityRole="timer"
            accessibilityLabel={`Tempo focado: ${formatDuration(timer.elapsedSeconds)}`}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatDuration(timer.elapsedSeconds)}
          </Text>
        </View>
        <Text variant="bodySm" color="textMuted" align="center">
          {timer.status === 'idle'
            ? 'Quando estiver pronto, comece. Deixe o celular de lado e leia com atenção total.'
            : timer.status === 'running'
              ? 'Lendo… a tela fica acesa enquanto o tempo corre.'
              : timer.reachedCap
                ? 'Você chegou ao limite de 4 horas por sessão. Encerre para salvar.'
                : 'Pausado. Retome quando voltar ao livro.'}
        </Text>
      </View>
      {active && !canFinish ? (
        <InlineMessage
          tone="info"
          message="Sessões contam a partir de 1 minuto de leitura focada."
        />
      ) : null}
    </FormScreen>
  );
}

function FinishStep({
  entry,
  userId,
  finished,
  onSaved,
}: {
  entry: ShelfEntry;
  userId: string;
  finished: Finished;
  onSaved: (result: SessionResult) => void;
}) {
  const theme = useTheme();
  const save = useRecordSession(userId);
  useConfirmLeave(!save.isSuccess);
  const total = entry.book.totalPages;
  const [page, setPage] = useState(String(entry.currentPage));
  const [reflection, setReflection] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);

  async function submit() {
    const endPage = Number(page.trim());
    if (
      !/^\d+$/.test(page.trim()) ||
      endPage < entry.currentPage ||
      (total !== null && endPage > total)
    ) {
      setPageError(
        total !== null
          ? `Informe uma página entre ${entry.currentPage} e ${total}.`
          : `Informe uma página a partir de ${entry.currentPage}.`,
      );
      haptics.warning();
      return;
    }
    setPageError(null);
    try {
      const result = await save.mutateAsync({
        id: finished.id,
        shelfEntryId: entry.id,
        startedAt: finished.startedAt.toISOString(),
        endedAt: finished.endedAt.toISOString(),
        focusedSeconds: finished.focusedSeconds,
        endPage,
        reflection: reflection.trim() === '' ? null : reflection.trim(),
        localDate: toLocalIsoDate(finished.endedAt),
      });
      haptics.success();
      onSaved(result);
    } catch {
      haptics.error();
    }
  }

  const errorMessage =
    save.error instanceof ApiError &&
    (save.error.code === 'NETWORK_ERROR' || save.error.code === 'TIMEOUT')
      ? 'Sem conexão. Sua sessão continua aqui — tente salvar de novo.'
      : 'Não foi possível salvar a sessão. Tente de novo.';

  return (
    <FormScreen
      back={false}
      footer={
        <Button
          label="Salvar sessão"
          icon="check"
          fullWidth
          loading={save.isPending}
          onPress={submit}
        />
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading" accessibilityRole="header">
          Boa leitura!
        </Text>
        <Text variant="body" color="textMuted">
          Você leu com foco por {formatDuration(finished.focusedSeconds)}. Registre até onde chegou.
        </Text>
      </View>
      {save.isError ? <InlineMessage tone="error" message={errorMessage} /> : null}
      <TextField
        label="Até que página você chegou?"
        icon="bookmark-border"
        keyboardType="number-pad"
        value={page}
        onChangeText={setPage}
        error={pageError}
        hint={
          total !== null ? `Você estava na página ${entry.currentPage} de ${total}.` : undefined
        }
      />
      <TextField
        label="O que ficou com você? (opcional)"
        icon="edit-note"
        placeholder="Uma ideia, uma frase, uma pergunta…"
        value={reflection}
        onChangeText={(value) => setReflection(value.slice(0, MAX_REFLECTION_LENGTH))}
        multiline
        textAlignVertical="top"
        hint="Explicar com suas palavras ajuda a lembrar depois."
      />
    </FormScreen>
  );
}

function ResultStep({ result }: { result: SessionResult }) {
  const theme = useTheme();
  const router = useRouter();
  const minutes = Math.floor(result.session.focusedSeconds / 60);
  const finishedBook = result.entry.status === 'finished';
  const stats = [
    { label: 'minutos focados', value: String(minutes) },
    {
      label: result.session.pagesRead === 1 ? 'página lida' : 'páginas lidas',
      value: String(result.session.pagesRead),
    },
    { label: 'XP ganho', value: `+${result.xpEarned}` },
  ];

  return (
    <FormScreen
      back={false}
      footer={
        <Button
          label="Voltar para Hoje"
          icon="home"
          fullWidth
          onPress={() => router.dismissTo('/')}
        />
      }
    >
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <BuboMascot state={finishedBook ? 'achievementUnlocked' : 'sessionComplete'} size={180} />
        <Chip
          label={
            result.stats.streakDays > 1
              ? `${result.stats.streakDays} dias seguidos`
              : 'Primeiro dia da sequência'
          }
          tone="orange"
          icon="local-fire-department"
          iconColor="orange"
          align="center"
        />
        <Text variant="display" align="center" accessibilityRole="header">
          {finishedBook ? 'Livro concluído!' : 'Essa leitura ficou.'}
        </Text>
        <Text variant="bodyLg" color="textMuted" align="center">
          {finishedBook
            ? `Você terminou ${result.entry.book.title}. Que jornada!`
            : 'Cada sessão focada fortalece o que você vai lembrar amanhã.'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {stats.map((item) => (
          <Card
            key={item.label}
            containerStyle={{ flex: 1 }}
            style={{ alignItems: 'center', padding: theme.spacing.md }}
          >
            <Text variant="heading" align="center">
              {item.value}
            </Text>
            <Text variant="bodySm" color="textMuted" align="center">
              {item.label}
            </Text>
          </Card>
        ))}
      </View>
    </FormScreen>
  );
}

/** Focused reading session: timer → pages + reflection → result ("Essa leitura ficou"). */
export default function ReadingSessionScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const detail = useShelfEntry(userId, typeof id === 'string' ? id : '');
  const [finished, setFinished] = useState<Finished | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);

  if (result) return <ResultStep result={result} />;
  if (detail.isPending || !userId) {
    return (
      <FormScreen>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando livro" />
      </FormScreen>
    );
  }
  if (detail.isError) {
    return (
      <FormScreen>
        <EmptyState
          mascot="error"
          title="Livro não encontrado"
          description="Ele pode ter sido removido da sua estante."
        />
      </FormScreen>
    );
  }

  const entry = detail.data.entry;
  if (finished) {
    return <FinishStep entry={entry} userId={userId} finished={finished} onSaved={setResult} />;
  }
  return (
    <TimerStep
      entry={entry}
      // The id is fixed once, so retrying a failed save never records the session twice.
      onFinish={(value) => setFinished({ ...value, id: Crypto.randomUUID() })}
    />
  );
}
