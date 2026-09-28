import { POST_BODY_MAX, POST_TITLE_MAX } from '@bubo/contracts';
import { MAX_BOOK_PAGES } from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  BookCover,
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  Icon,
  InlineMessage,
  Text,
  TextField,
} from '../../design-system';
import { ApiError } from '../../lib/api/client';
import { useClub, useCreateClubPost } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/** Stitch `bubo_criar_novo_t_pico_de_debate_anti_spoiler_mobile`: every debate names its page. */
export default function NewTopicScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId: string }>();
  const clubId = typeof params.clubId === 'string' ? params.clubId : '';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const club = useClub(userId || undefined, clubId);
  const create = useCreateClubPost(userId, clubId);
  // Stable across retries: the API treats a repeated id as the same topic.
  const topicId = useRef(Crypto.randomUUID());

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [page, setPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (club.isPending) {
    return (
      <FormScreen title="Novo debate">
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando clube" />
      </FormScreen>
    );
  }
  if (club.isError || !club.data.membership) {
    return (
      <FormScreen title="Novo debate">
        <EmptyState
          mascot="notFound"
          title="Entre no clube para debater"
          description="Só membros abrem debates."
        />
      </FormScreen>
    );
  }

  const data = club.data;
  const readerPage = data.readerPage ?? 0;
  const maxPage = data.book.totalPages ?? MAX_BOOK_PAGES;
  const pageText = page ?? String(readerPage);
  const pageNumber = /^\d+$/.test(pageText.trim()) ? Number(pageText.trim()) : null;

  function step(delta: number) {
    const next = Math.min(maxPage, Math.max(0, (pageNumber ?? readerPage) + delta));
    haptics.selection();
    setPage(String(next));
  }

  async function publish() {
    if (title.trim().length < 3) {
      setError('Escreva uma pergunta ou título com pelo menos 3 letras.');
      return;
    }
    if (body.trim().length === 0) {
      setError('Conte sua argumentação ou reflexão.');
      return;
    }
    if (pageNumber === null || pageNumber > maxPage) {
      setError(`Informe uma página entre 0 e ${maxPage}.`);
      return;
    }
    setError(null);
    try {
      const post = await create.mutateAsync({
        id: topicId.current,
        title: title.trim(),
        body: body.trim(),
        spoilerPage: pageNumber,
      });
      haptics.success();
      router.replace({
        pathname: '/debates/[clubId]/[postId]',
        params: { clubId, postId: post.id },
      });
    } catch (e) {
      haptics.error();
      setError(
        e instanceof ApiError && e.code === 'RATE_LIMITED'
          ? 'Muitas publicações seguidas. Espere um minuto.'
          : e instanceof ApiError && e.code === 'VALIDATION_FAILED'
            ? 'Confira o título, o texto e a página.'
            : 'Não foi possível publicar agora. Tente de novo.',
      );
    }
  }

  const stepper = (delta: number, label: string) => (
    <Button
      label={label}
      variant="secondary"
      size="md"
      compact
      style={{ flex: 1 }}
      onPress={() => step(delta)}
      accessibilityHint={`${delta > 0 ? 'Aumenta' : 'Diminui'} a página em ${Math.abs(delta)}`}
    />
  );

  return (
    <FormScreen
      title="Novo debate"
      eyebrow={data.name}
      footer={
        <>
          {error ? <InlineMessage tone="error" message={error} /> : null}
          <Button
            label="Publicar debate"
            icon="campaign"
            fullWidth
            loading={create.isPending}
            onPress={publish}
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
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="bodyStrong" numberOfLines={2}>
              {data.book.title}
            </Text>
            <Chip label={`Seu progresso: pág. ${readerPage}`} tone="primary" />
          </View>
        </View>
      </Card>

      <Card tone="muted">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BuboMascot state="recallPrompt" size={72} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="caption" color="accentText">
              Mediação do Bubo
            </Text>
            <Text variant="bodySm">
              Informe a página exata de que o debate fala. Quem ainda não chegou lá vê só um aviso.
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <TextField
          label="Pergunta ou título do debate"
          placeholder="Ex.: A presciência de Paul é uma prisão?"
          value={title}
          onChangeText={setTitle}
          maxLength={POST_TITLE_MAX}
        />
        <View style={{ gap: theme.spacing.xs }}>
          <TextField
            label="Página do livro"
            keyboardType="number-pad"
            value={pageText}
            onChangeText={setPage}
            hint={
              data.book.totalPages
                ? `de ${data.book.totalPages}. Use 0 para um debate geral.`
                : 'Use 0 para um debate geral.'
            }
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {stepper(-10, '−10')}
            {stepper(-1, '−1')}
            {stepper(1, '+1')}
            {stepper(10, '+10')}
          </View>
        </View>
        <TextField
          label="Sua argumentação ou reflexão"
          placeholder="O que você pensa sobre isso?"
          value={body}
          onChangeText={setBody}
          maxLength={POST_BODY_MAX}
          multiline
          textAlignVertical="top"
        />
      </Card>

      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.md,
          alignItems: 'center',
          padding: theme.spacing.lg,
          borderRadius: theme.radii.card,
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primarySoft,
        }}
      >
        <Icon name="shield" size={28} color="accentText" />
        <Text variant="bodySm" color="accentText" style={{ flex: 1 }}>
          {pageNumber && pageNumber > 0
            ? `Escudo anti-spoiler: leitores antes da pág. ${pageNumber} verão só um aviso.`
            : 'Debate geral (pág. 0): visível para todos os membros. Não conte o que acontece no livro.'}
        </Text>
      </View>
    </FormScreen>
  );
}
