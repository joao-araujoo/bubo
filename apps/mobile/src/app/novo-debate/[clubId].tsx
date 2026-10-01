import { POST_BODY_MAX, POST_QUOTE_MAX, POST_TITLE_MAX } from '@bubo/contracts';
import { MAX_BOOK_PAGES, type TopicKind } from '@bubo/domain';
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
  IconTile,
  InlineMessage,
  Pill,
  Raised,
  Stepper,
  Text,
  TextField,
  Toggle,
} from '../../design-system';
import { membersLabel, TOPIC_KIND_CHOICES, TOPIC_KIND_META } from '../../features/community/meta';
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
  const [kind, setKind] = useState<TopicKind>('philosophical');
  const [chapter, setChapter] = useState('');
  const [page, setPage] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quote, setQuote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (club.isPending) {
    return (
      <FormScreen leading="close" title="Novo tópico de debate">
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando clube" />
      </FormScreen>
    );
  }
  if (club.isError || !club.data.membership) {
    return (
      <FormScreen leading="close" title="Novo tópico de debate">
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
  const chapterNumber =
    chapter.trim() === '' ? null : /^\d+$/.test(chapter.trim()) ? Number(chapter.trim()) : NaN;

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
    if (
      Number.isNaN(chapterNumber) ||
      (chapterNumber !== null && (chapterNumber < 1 || chapterNumber > 999))
    ) {
      setError('O capítulo precisa ser um número de 1 a 999 (ou deixe em branco).');
      return;
    }
    setError(null);
    try {
      const post = await create.mutateAsync({
        id: topicId.current,
        title: title.trim(),
        body: body.trim(),
        spoilerPage: pageNumber,
        kind,
        chapter: chapterNumber,
        quote: quoteOpen && quote.trim() ? quote.trim() : null,
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
            ? 'Confira o título, o texto, o capítulo e a página.'
            : 'Não foi possível publicar agora. Tente de novo.',
      );
    }
  }

  return (
    <FormScreen
      leading="close"
      title="Novo tópico de debate"
      eyebrow="Clube de leitura"
      footer={
        <>
          {error ? <InlineMessage tone="error" message={error} /> : null}
          <Button
            label="Publicar debate no clube"
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                Seu progresso atual:
              </Text>
              <Pill label={`Página ${readerPage}`} />
            </View>
          </View>
        </View>
      </Card>

      <BuboTip state="recallPrompt" caps={false} title="Mediação do Bubo">
        Informe o capítulo e a página exata do debate. O Bubo ativa a blindagem automática para os
        colegas que ainda não chegaram aí!
      </BuboTip>

      <Card>
        <View style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text variant="label" style={{ flex: 1 }}>
              Pergunta ou título do debate
              <Text variant="label" color="accentText">
                {' *'}
              </Text>
            </Text>
            <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
              Provocação reflexiva
            </Text>
          </View>
          <TextField
            label="Pergunta ou título do debate"
            hideLabel
            placeholder="A presciência de Paul é uma prisão trágica ou…"
            value={title}
            onChangeText={setTitle}
            maxLength={POST_TITLE_MAX}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="label" style={{ flex: 1 }}>
            Tipo de discussão
          </Text>
          <Text variant="bodySm" color="accentText" style={{ fontSize: 12 }}>
            Selecione 1
          </Text>
        </View>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
        >
          {TOPIC_KIND_CHOICES.map((option) => {
            const meta = TOPIC_KIND_META[option];
            const selected = option === kind;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={meta.label}
                style={{ width: '48%' }}
                onPress={() => {
                  haptics.selection();
                  setKind(option);
                }}
              >
                {({ pressed }) => (
                  <Raised
                    faceColor={selected ? theme.colors.surfaceMuted : theme.colors.surface}
                    borderColor={selected ? theme.colors.primary : theme.colors.border}
                    rimColor={selected ? theme.colors.primaryRim : theme.colors.secondaryRim}
                    radius={theme.radii.lg}
                    depth={3}
                    pressed={pressed}
                    faceStyle={{
                      alignItems: 'center',
                      gap: theme.spacing.xs,
                      paddingVertical: theme.spacing.md,
                    }}
                  >
                    <Icon
                      name={meta.icon}
                      size={24}
                      color={selected ? 'accentText' : 'textMuted'}
                    />
                    <Text variant="label" color={selected ? 'accentText' : 'text'} align="center">
                      {meta.label}
                    </Text>
                  </Raised>
                )}
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: theme.colors.primarySoft,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Icon name="bookmark-border" size={20} color="accentText" />
            <Text variant="label" style={{ flex: 1 }}>
              Ponto do livro
            </Text>
            <Pill label="Base da blindagem" />
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-end' }}>
            <View style={{ width: 104 }}>
              <TextField
                label="Capítulo"
                keyboardType="number-pad"
                placeholder="—"
                value={chapter}
                onChangeText={setChapter}
                maxLength={3}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Stepper
                label="Página"
                value={pageText}
                onChangeText={setPage}
                max={maxPage}
                suffix={data.book.totalPages ? `de ${data.book.totalPages}` : undefined}
              />
            </View>
          </View>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label">
            Sua argumentação ou reflexão
            <Text variant="label" color="accentText">
              {' *'}
            </Text>
          </Text>
          <TextField
            label="Sua argumentação ou reflexão"
            hideLabel
            placeholder="Ao observar a transformação de Paul no deserto, fica claro que…"
            value={body}
            onChangeText={setBody}
            maxLength={POST_BODY_MAX}
            multiline
            textAlignVertical="top"
          />
        </View>

        {quoteOpen ? (
          <TextField
            label="Citação do trecho (opcional)"
            icon="format-quote"
            placeholder="“Não terei medo. O medo é o assassino da mente…”"
            value={quote}
            onChangeText={setQuote}
            maxLength={POST_QUOTE_MAX}
            multiline
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vincular citação do trecho"
            onPress={() => setQuoteOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              minHeight: theme.sizes.touchTarget,
              padding: theme.spacing.md,
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.colors.purpleLight,
            }}
          >
            <Icon name="format-quote" size={22} color="accentText" />
            <View style={{ flex: 1 }}>
              <Text variant="label">Vincular citação do trecho</Text>
              <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                Um trecho curto da página, para ancorar o debate
              </Text>
            </View>
            <Text variant="label" color="accentText">
              Adicionar
            </Text>
          </Pressable>
        )}

        <View
          style={{
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radii.lg,
            borderWidth: theme.sizes.borderWidth,
            borderColor: theme.colors.purpleLight,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <IconTile icon="shield" size={40} solid />
            <View style={{ flex: 1 }}>
              <Toggle
                title="Escudo anti-spoiler ativo"
                description={`Protege quem está antes da pág. ${pageNumber ?? 0}`}
                value
                locked
              />
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.primarySoft,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Icon name="verified-user" size={18} color="accentText" />
            <Text variant="bodySm" color="accentText" style={{ flex: 1 }}>
              {pageNumber && pageNumber > 0
                ? `O conteúdo recebe o véu protetor automático para leitores abaixo da página ${pageNumber}.`
                : 'Página 0: debate geral, visível para todos os membros. Não conte o que acontece no livro.'}
            </Text>
          </View>
        </View>
      </Card>
    </FormScreen>
  );
}
