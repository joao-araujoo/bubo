import {
  BOOK_REVIEW_MIN,
  POST_BODY_MAX,
  POST_TITLE_MAX,
  REVIEW_TAGS,
  REVIEW_TAGS_MAX,
  type ReviewTag,
  createPostRequestSchema,
} from '@bubo/contracts';
import { MAX_BOOK_PAGES, readingProgress } from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

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
  SectionTitle,
  Stepper,
  TabChip,
  Text,
  TextField,
  Toggle,
} from '../../design-system';
import {
  REVIEW_TAG_META,
  membersLabel,
  ratingLabel,
  wordsLabel,
} from '../../features/community/meta';
import { StarRating } from '../../features/community/StarRating';
import { ApiError } from '../../lib/api/client';
import { useClub, useCreateClubPost } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type SpoilerPoint = 'half' | 'mine' | 'end';

/**
 * Stitch "Avaliar & Resenhar": book, Bubo's tip, stars, how the reading resonated, title, text,
 * anti-spoiler point and where it is shared. Reviews live in the club of the shared catalog book,
 * so page numbers mean the same for every member (ADR-019).
 */
export default function NewBookReviewScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const id = typeof clubId === 'string' ? clubId : '';
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const club = useClub(userId || undefined, id);
  const create = useCreateClubPost(userId, id);
  const uuid = useRef(Crypto.randomUUID());
  const submitting = useRef(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [shield, setShield] = useState(false);
  const [page, setPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (club.isPending)
    return (
      <FormScreen title="Avaliar & Resenhar" eyebrow="Resenha" eyebrowDot>
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="Carregando livro do clube"
        />
      </FormScreen>
    );
  if (club.isError)
    return (
      <FormScreen title="Avaliar & Resenhar" eyebrow="Resenha" eyebrowDot>
        <EmptyState
          mascot="offline"
          title="Não foi possível abrir o clube"
          description="Verifique sua conexão e seu acesso ao clube."
          action={
            <Button label="Tentar de novo" icon="refresh" onPress={() => void club.refetch()} />
          }
        />
      </FormScreen>
    );
  const data = club.data;
  if (!data.membership)
    return (
      <FormScreen title="Avaliar & Resenhar" eyebrow="Resenha" eyebrowDot>
        <EmptyState
          mascot="emptyCommunity"
          title="Entre no clube para publicar"
          description="Resenhas são compartilhadas somente com os membros."
        />
      </FormScreen>
    );

  const total = data.book.totalPages;
  const readerPage = data.readerPage ?? 0;
  const progress = total ? readingProgress(readerPage, total).percent : null;
  const maxPage = total ?? MAX_BOOK_PAGES;
  const pointPage: Record<SpoilerPoint, number | null> = {
    half: total ? Math.max(1, Math.round(total / 2)) : null,
    mine: readerPage > 0 ? Math.min(readerPage, maxPage) : null,
    end: total,
  };
  const defaultShieldPage = pointPage.mine ?? pointPage.end ?? 1;
  const pageText = shield ? (page ?? String(defaultShieldPage)) : '0';
  const pageNumber = /^\d+$/.test(pageText) ? Number(pageText) : null;
  const busy = create.isPending;

  const toggleTag = (tag: ReviewTag) => {
    if (busy) return;
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : current.length >= REVIEW_TAGS_MAX
          ? current
          : [...current, tag],
    );
  };

  async function publish() {
    if (submitting.current) return;
    if (rating === null) {
      setError('Escolha de 1 a 5 estrelas.');
      return;
    }
    const input = createPostRequestSchema.safeParse({
      id: uuid.current,
      title,
      body,
      reviewRating: rating,
      reviewTags: tags,
      kind: 'discussion',
      spoilerPage: pageNumber ?? -1,
    });
    if (!input.success || pageNumber === null || pageNumber > maxPage) {
      setError(
        title.trim().length < 3
          ? 'Dê um título com pelo menos 3 caracteres.'
          : body.trim().length < BOOK_REVIEW_MIN
            ? `Escreva pelo menos ${BOOK_REVIEW_MIN} caracteres na resenha.`
            : `Informe uma página entre 1 e ${maxPage}.`,
      );
      return;
    }
    submitting.current = true;
    setError(null);
    try {
      const review = await create.mutateAsync(input.data);
      haptics.success();
      router.replace({
        pathname: '/resenhas/[clubId]/[postId]',
        params: { clubId: id, postId: review.id },
      });
    } catch (e) {
      haptics.error();
      setError(
        e instanceof ApiError && e.code === 'RATE_LIMITED'
          ? 'Muitas publicações seguidas. Espere um minuto; sua resenha continua aqui.'
          : 'Não foi possível publicar. Sua resenha continua aqui para tentar de novo.',
      );
    } finally {
      submitting.current = false;
    }
  }

  return (
    <FormScreen
      title="Avaliar & Resenhar"
      eyebrow="Resenha"
      eyebrowDot
      footer={
        <>
          {error ? <InlineMessage tone="error" message={error} /> : null}
          <Button
            label="Publicar resenha"
            icon="publish"
            fullWidth
            loading={busy}
            onPress={() => void publish()}
          />
        </>
      }
    >
      <Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <BookCover
            title={data.book.title}
            author={data.book.author}
            coverUrls={data.book.coverUrls}
            width={56}
          />
          <View style={{ flex: 1, gap: 2 }}>
            {data.book.author ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="menu-book" size={14} color="accentText" />
                <Text variant="label" color="accentText" numberOfLines={1} style={{ flex: 1 }}>
                  {data.book.author}
                </Text>
              </View>
            ) : null}
            <Text variant="titleSm" numberOfLines={2}>
              {data.book.title}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {total ? `${total} págs • você está na pág. ${readerPage}` : `Pág. ${readerPage}`}
            </Text>
          </View>
          {progress !== null ? (
            <Pill
              tone={progress >= 100 ? 'success' : 'primary'}
              icon={progress >= 100 ? 'check-circle-outline' : 'auto-stories'}
              label={`Lido ${progress}%`}
            />
          ) : null}
        </View>
      </Card>

      <BuboTip pose="takingNotes" title="Dica crítica do Bubo" titleIcon="verified">
        <Text variant="bodySm">
          Conte o que ficou com você, com suas palavras. Se comentar o desfecho, ligue a proteção:
          quem ainda está antes da página escolhida vê só um véu.
        </Text>
      </BuboTip>

      <Card>
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <Text variant="caption" color="textMuted">
            Sua avaliação geral
          </Text>
          <StarRating
            value={rating}
            size={36}
            disabled={busy}
            onChange={(value) => {
              setRating(value);
              setError(null);
            }}
          />
          {rating !== null ? (
            <Pill tone="warning" label={`${rating}.0 • ${ratingLabel(rating)}`} />
          ) : (
            <Text variant="bodySm" color="textMuted">
              Toque nas estrelas
            </Text>
          )}
        </View>
      </Card>

      <SectionTitle
        icon="psychology"
        title="Como essa leitura reverberou?"
        trailing={
          <Text variant="label" color="accentText">
            {`${tags.length}/${REVIEW_TAGS_MAX}`}
          </Text>
        }
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {REVIEW_TAGS.map((tag) => (
          <TabChip
            key={tag}
            role="checkbox"
            label={REVIEW_TAG_META[tag].label}
            icon={REVIEW_TAG_META[tag].icon}
            selected={tags.includes(tag)}
            onPress={() => toggleTag(tag)}
          />
        ))}
      </View>

      <TextField
        label="Título da sua resenha"
        placeholder="Ex.: Mais que uma história, um espelho"
        value={title}
        onChangeText={setTitle}
        maxLength={POST_TITLE_MAX}
        editable={!busy}
      />
      <View style={{ gap: theme.spacing.xs }}>
        <TextField
          label="Sua resenha completa"
          placeholder="O que esta leitura deixou em você?"
          value={body}
          onChangeText={setBody}
          maxLength={POST_BODY_MAX}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          editable={!busy}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
            {wordsLabel(body)}
          </Text>
          <Text
            variant="label"
            color={body.trim().length >= BOOK_REVIEW_MIN ? 'successText' : 'textMuted'}
            style={{ fontSize: 12 }}
          >
            {body.trim().length >= BOOK_REVIEW_MIN
              ? 'Pronta para publicar'
              : `Mínimo de ${BOOK_REVIEW_MIN} caracteres`}
          </Text>
        </View>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
          <IconTile icon="shield" size={44} />
          <View style={{ flex: 1 }}>
            <Toggle
              title="Proteção anti-spoiler"
              badge={shield ? <Pill caps label="Ativo" /> : undefined}
              description="Oculta título, nota e texto de quem ainda não chegou à página escolhida."
              value={shield}
              onValueChange={(next) => {
                if (busy) return;
                setShield(next);
                setPage(null);
              }}
            />
          </View>
        </View>
        {shield ? (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />
            <Text variant="label">Avisar a partir de qual ponto?</Text>
            <View
              accessibilityRole="radiogroup"
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
            >
              {(
                [
                  ['half', 'Até o meio'],
                  ['mine', 'Até onde li'],
                  ['end', 'Final / desfecho'],
                ] as const
              ).map(([point, label]) => {
                const value = pointPage[point];
                if (value === null) return null;
                return (
                  <TabChip
                    key={point}
                    role="radio"
                    label={`${label} (p. ${value})`}
                    icon={point === 'end' ? 'shield' : undefined}
                    selected={pageNumber === value}
                    onPress={() => setPage(String(value))}
                  />
                );
              })}
            </View>
            <Stepper
              label="Página exata"
              value={pageText}
              onChangeText={(value) => {
                if (!busy) setPage(value);
              }}
              min={1}
              max={maxPage}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surfaceMuted,
              }}
            >
              <Icon name="visibility-off" size={18} color="textMuted" />
              <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
                {pageNumber
                  ? `Quem está antes da pág. ${pageNumber} vê só o véu e a página.`
                  : 'Escolha uma página.'}
              </Text>
              <Pill caps label="Como outros verão" />
            </View>
          </View>
        ) : (
          <Text variant="bodySm" color="textMuted">
            Sem proteção, a resenha aparece para todos os membros. Use só se ela não revela nada da
            trama.
          </Text>
        )}
      </Card>

      <SectionTitle icon="share" title="Onde compartilhar?" />
      <Card tone="muted" accessibilityLabel={`Compartilhada no clube ${data.name}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <IconTile icon="check" size={32} solid />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {data.name}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {`${membersLabel(data.memberCount)} • só membros do clube`}
            </Text>
          </View>
        </View>
      </Card>
    </FormScreen>
  );
}
