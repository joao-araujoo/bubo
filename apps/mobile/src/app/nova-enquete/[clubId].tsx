import { POLL_OPTION_MAX, POLL_QUESTION_MAX } from '@bubo/contracts';
import { MAX_BOOK_PAGES, POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  BookCover,
  BuboTip,
  Button,
  Card,
  EmptyState,
  FormScreen,
  Icon,
  InlineMessage,
  Pill,
  SegmentedTabs,
  Stepper,
  Text,
  TextField,
} from '../../design-system';
import { membersLabel } from '../../features/community/meta';
import { ApiError } from '../../lib/api/client';
import { useClub, useCreateClubPoll } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/** Stitch `bubo_criar_nova_enquete_do_clube_mobile`. */
export default function NewPollScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId: string }>();
  const clubId = typeof params.clubId === 'string' ? params.clubId : '';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const club = useClub(userId || undefined, clubId);
  const create = useCreateClubPoll(userId, clubId);
  const pollId = useRef(Crypto.randomUUID());

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [duration, setDuration] = useState<'3' | '7'>('3');
  const [mode, setMode] = useState<'single' | 'multiple'>('single');
  const [page, setPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (club.isPending) {
    return (
      <FormScreen leading="close" title="Nova enquete">
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando clube" />
      </FormScreen>
    );
  }
  if (club.isError || !club.data.membership) {
    return (
      <FormScreen leading="close" title="Nova enquete">
        <EmptyState
          mascot="notFound"
          title="Entre no clube para criar enquetes"
          description="Só membros criam enquetes."
        />
      </FormScreen>
    );
  }

  const data = club.data;
  const readerPage = data.readerPage ?? 0;
  const maxPage = data.book.totalPages ?? MAX_BOOK_PAGES;
  const pageText = page ?? String(readerPage);
  const pageNumber = /^\d+$/.test(pageText.trim()) ? Number(pageText.trim()) : null;

  const setOption = (index: number, value: string) =>
    setOptions((current) => current.map((option, i) => (i === index ? value : option)));

  async function launch() {
    const cleaned = options.map((option) => option.trim());
    if (question.trim().length < 5) {
      setError('Escreva uma pergunta com pelo menos 5 letras.');
      return;
    }
    if (cleaned.some((option) => option === '')) {
      setError('Preencha todas as opções (ou remova as vazias).');
      return;
    }
    if (
      new Set(cleaned.map((option) => option.toLocaleLowerCase('pt-BR'))).size !== cleaned.length
    ) {
      setError('As opções precisam ser diferentes.');
      return;
    }
    if (pageNumber === null || pageNumber > maxPage) {
      setError(`Informe uma página entre 0 e ${maxPage}.`);
      return;
    }
    setError(null);
    try {
      const poll = await create.mutateAsync({
        id: pollId.current,
        question: question.trim(),
        options: cleaned,
        multiple: mode === 'multiple',
        durationDays: duration === '7' ? 7 : 3,
        spoilerPage: pageNumber,
      });
      haptics.success();
      router.replace({
        pathname: '/enquetes/[clubId]/[pollId]',
        params: { clubId, pollId: poll.id },
      });
    } catch (e) {
      haptics.error();
      setError(
        e instanceof ApiError && e.code === 'RATE_LIMITED'
          ? 'Muitas publicações seguidas. Espere um minuto.'
          : e instanceof ApiError && e.code === 'VALIDATION_FAILED'
            ? 'Confira a pergunta, as opções e a página.'
            : 'Não foi possível lançar a enquete agora.',
      );
    }
  }

  return (
    <FormScreen
      leading="close"
      title="Nova enquete"
      eyebrow="Clube de leitura"
      footer={
        <>
          {error ? <InlineMessage tone="error" message={error} /> : null}
          <Button
            label="Lançar enquete no clube"
            icon="publish"
            fullWidth
            loading={create.isPending}
            onPress={launch}
          />
        </>
      }
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BookCover
            title={data.book.title}
            author={data.book.author}
            coverUrls={data.book.coverUrls}
            width={48}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Icon name="group" size={15} color="accentText" />
              <Text variant="bodySm" color="accentText" numberOfLines={1} style={{ flex: 1 }}>
                {`${data.name} • ${membersLabel(data.memberCount)}`}
              </Text>
            </View>
            <Text variant="bodyStrong" numberOfLines={1}>
              {[data.book.author, data.book.totalPages ? `${data.book.totalPages} páginas` : null]
                .filter(Boolean)
                .join(' • ') || data.book.title}
            </Text>
            <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
              Seu progresso:{' '}
              <Text variant="bodySm" color="accentText" style={{ fontSize: 12 }}>
                {`Página ${readerPage}`}
              </Text>
            </Text>
          </View>
        </View>
      </Card>

      <BuboTip pose="idea" title="Estímulo reflexivo" titleIcon="psychology">
        Crie perguntas que dividam opiniões e façam os membros debaterem o significado profundo da
        obra!
      </BuboTip>

      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="label" style={{ flex: 1 }}>
            Pergunta ou provocação filosófica
            <Text variant="label" color="accentText">
              {' *'}
            </Text>
          </Text>
          <Text variant="bodySm" color="accentText" style={{ fontSize: 12 }}>
            Foco reflexivo
          </Text>
        </View>
        <TextField
          label="Pergunta ou provocação filosófica"
          hideLabel
          placeholder="A presciência de Paul é um dom libertador ou uma condenação fatalista?"
          value={question}
          onChangeText={setQuestion}
          maxLength={POLL_QUESTION_MAX}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name="how-to-vote" size={20} color="accentText" />
          <Text variant="label" style={{ flex: 1 }}>
            {`Opções de voto (mínimo ${POLL_MIN_OPTIONS})`}
          </Text>
          <Text variant="bodySm" color="textMuted">
            {`${options.length} de ${POLL_MAX_OPTIONS}`}
          </Text>
        </View>
        {options.map((option, index) => (
          <View
            key={index}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: theme.radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: theme.sizes.borderWidth,
                borderColor: theme.colors.purpleLight,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Text variant="label" color="accentText">
                {index + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label={`Opção ${index + 1}`}
                hideLabel
                placeholder={index === 0 ? 'Uma prisão fatalista' : 'Um dom libertador'}
                value={option}
                onChangeText={(value) => setOption(index, value)}
                maxLength={POLL_OPTION_MAX}
              />
            </View>
            {options.length > POLL_MIN_OPTIONS ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remover opção ${index + 1}`}
                hitSlop={8}
                onPress={() => setOptions((current) => current.filter((_, i) => i !== index))}
                style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={20} color="textMuted" />
              </Pressable>
            ) : null}
          </View>
        ))}
        {options.length < POLL_MAX_OPTIONS ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adicionar opção alternativa"
            onPress={() => {
              haptics.selection();
              setOptions((current) => [...current, '']);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xs,
              minHeight: theme.sizes.touchTarget,
              borderRadius: theme.radii.lg,
              borderWidth: theme.sizes.borderWidth,
              borderStyle: 'dashed',
              borderColor: theme.colors.purpleLight,
            }}
          >
            <Icon name="add-circle-outline" size={20} color="accentText" />
            <Text variant="label" color="accentText">
              Adicionar opção alternativa
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Icon name="timelapse" size={16} color="accentText" />
            <Text variant="label">Duração ativa</Text>
          </View>
          <SegmentedTabs
            accessibilityLabel="Duração da enquete"
            value={duration}
            onChange={setDuration}
            options={[
              { id: '3', label: '3 Dias' },
              { id: '7', label: '7 Dias' },
            ]}
          />
        </View>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Icon name="tune" size={16} color="accentText" />
            <Text variant="label">Tipo de votação</Text>
          </View>
          <SegmentedTabs
            accessibilityLabel="Tipo de votação"
            value={mode}
            onChange={setMode}
            options={[
              { id: 'single', label: 'Única' },
              { id: 'multiple', label: 'Múltipla' },
            ]}
          />
        </View>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name="shield" size={20} color="accentText" />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            Blindagem anti-spoiler da enquete
          </Text>
          <Pill label="Proteção inteligente" />
        </View>
        <Stepper
          label="Página de bloqueio"
          value={pageText}
          onChangeText={setPage}
          max={maxPage}
          suffix={data.book.totalPages ? `de ${data.book.totalPages}` : undefined}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name="lock-outline" size={16} color="textMuted" />
          <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
            {pageNumber && pageNumber > 0
              ? `Quem não chegou na pág. ${pageNumber} verá véu protetor com aviso, sem a pergunta nem as opções.`
              : 'Página 0: enquete geral, visível para todos os membros.'}
          </Text>
        </View>
      </Card>
    </FormScreen>
  );
}
