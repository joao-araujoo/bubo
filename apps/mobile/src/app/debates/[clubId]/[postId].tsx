import { type ClubPost, type ClubReply, REPLY_BODY_MAX } from '@bubo/contracts';
import { COGNITIVE_LEVELS } from '@bubo/scoring';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';

import {
  Avatar,
  BookCover,
  Button,
  EmptyState,
  FormScreen,
  Icon,
  IconTile,
  InlineMessage,
  Pill,
  Raised,
  SectionTitle,
  Text,
} from '../../../design-system';
import {
  anchorLabel,
  ratingLabel,
  relativeTime,
  REVIEW_TAG_META,
  TOPIC_KIND_META,
} from '../../../features/community/meta';
import { ActionChip } from '../../../features/community/ActionChip';
import { ReactionBar } from '../../../features/community/ReactionBar';
import { ReportPanel } from '../../../features/community/ReportPanel';
import { SpoilerVeil } from '../../../features/community/SpoilerVeil';
import { StarRating } from '../../../features/community/StarRating';
import { ApiError } from '../../../lib/api/client';
import {
  useBlockUser,
  useChangeFriend,
  useClub,
  useClubTopic,
  useCreateClubReply,
  useDeleteClubContent,
  useFriends,
  useModerateClubContent,
  useSetReaction,
} from '../../../lib/api/queries';
import { useAuthState } from '../../../lib/auth/session';
import { haptics } from '../../../lib/haptics';
import { fontFamily, useTheme } from '../../../theme';

type Target = { targetType: 'post' | 'reply'; targetId: string };
type Item = Pick<ClubPost, 'id' | 'author' | 'isMine' | 'moderation' | 'openReportCount'>;

const levelTitle = (level: number) =>
  COGNITIVE_LEVELS.find((candidate) => candidate.level === level)?.title ?? 'Leitor';

/** Stitch "Véu anti-spoiler cognitivo" for the topic itself (the API sent no text). */
function BigVeil({
  page,
  readerPage,
  onReveal,
}: {
  page: number;
  readerPage: number;
  onReveal: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
        borderRadius: 22,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.purpleLight,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <IconTile icon="lock" size={56} solid />
      <Pill caps label="Véu anti-spoiler" />
      <Text variant="bodyStrong" align="center">
        {`Conteúdo da página ${page}`}
      </Text>
      <Text variant="bodySm" color="textMuted" align="center">
        {`Você está na pág. ${readerPage}. Atualize seu progresso na Estante para liberar, ou revele por sua conta.`}
      </Text>
      <Button
        label="Revelar trecho"
        icon="visibility"
        variant="secondary"
        size="md"
        onPress={onReveal}
      />
    </View>
  );
}

/** Debate thread (Stitch "Detalhes da discussão"): topic, reactions, replies and the composer. */
export default function TopicScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId: string; postId: string; reveal?: string }>();
  const clubId = typeof params.clubId === 'string' ? params.clubId : '';
  const postId = typeof params.postId === 'string' ? params.postId : '';
  const reveal = params.reveal === '1';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const myName = auth.status === 'ready' ? auth.me.user.name : '';

  const club = useClub(userId || undefined, clubId);
  const topic = useClubTopic(userId || undefined, clubId, postId, reveal);
  const reply = useCreateClubReply(userId, clubId, postId);
  const remove = useDeleteClubContent(userId, clubId);
  const moderate = useModerateClubContent(userId, clubId);
  const block = useBlockUser(userId);
  const react = useSetReaction(userId);
  const friends = useFriends(userId || undefined);
  const befriend = useChangeFriend(userId);

  const replyId = useRef(Crypto.randomUUID());
  const [body, setBody] = useState('');
  const [page, setPage] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Target | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isOwner = club.data?.membership === 'owner';
  const eyebrow = club.data ? club.data.name : 'Clube de leitura';

  if (topic.isPending) {
    return (
      <FormScreen title="Debate do clube" eyebrow={eyebrow}>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando debate" />
      </FormScreen>
    );
  }
  if (topic.isError) {
    const gone = topic.error instanceof ApiError && topic.error.code === 'NOT_FOUND';
    return (
      <FormScreen title="Debate do clube" eyebrow={eyebrow}>
        <EmptyState
          mascot={gone ? 'notFound' : 'offline'}
          title={gone ? 'Debate indisponível' : 'Não foi possível carregar'}
          description={
            gone
              ? 'Ele foi apagado, removido pela moderação, denunciado por você ou é de alguém que você bloqueou.'
              : 'Verifique sua conexão e tente de novo.'
          }
          action={
            gone ? undefined : (
              <Button label="Tentar de novo" icon="refresh" onPress={() => void topic.refetch()} />
            )
          }
        />
      </FormScreen>
    );
  }

  const { post, replies, readerPage } = topic.data;
  const defaultPage = Math.max(readerPage, post.spoilerPage);
  const pageText = page ?? String(defaultPage);
  const peek = () => router.setParams({ reveal: '1' });
  const safe = !post.locked && post.spoilerPage <= readerPage;

  const friendStatus = friends.data?.friends.find(
    (friend) => friend.userId === post.author.id,
  )?.status;
  const addFriend = (action: 'request' | 'accept') =>
    befriend.mutate(
      { otherId: post.author.id, action },
      {
        onSuccess: () => {
          haptics.success();
          setNotice(
            action === 'accept'
              ? `Agora você e ${post.author.name} são amigos de leitura.`
              : `Pedido enviado. ${post.author.name} escolhe se aceita.`,
          );
        },
        onError: (e) => {
          haptics.error();
          setNotice(null);
          setReplyError(
            e instanceof ApiError && e.code === 'NOT_FOUND'
              ? 'Esta pessoa não está recebendo pedidos de amizade agora.'
              : 'Não foi possível enviar o pedido de amizade.',
          );
        },
      },
    );

  const confirmDelete = (target: Target) =>
    Alert.alert(
      target.targetType === 'post' ? 'Apagar este debate?' : 'Apagar esta resposta?',
      target.targetType === 'post'
        ? 'O debate e todas as respostas somem para sempre.'
        : 'A resposta some para sempre.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () =>
            remove.mutate(target, {
              onSuccess: () => {
                haptics.success();
                if (target.targetType === 'post') router.back();
              },
              onError: () => haptics.error(),
            }),
        },
      ],
    );

  const confirmBlock = (author: Item['author']) =>
    Alert.alert(
      `Bloquear ${author.name}?`,
      'Os debates e respostas dessa pessoa somem para você em todos os clubes. Você pode desbloquear em Você → Leitores bloqueados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () =>
            block.mutate(author.id, {
              onSuccess: () => {
                haptics.success();
                if (author.id === post.author.id) router.back();
                else setNotice(`${author.name} foi bloqueado.`);
              },
              onError: () => haptics.error(),
            }),
        },
      ],
    );

  const runModeration = (target: Target, action: 'remove' | 'restore') =>
    moderate.mutate(
      { ...target, action },
      {
        onSuccess: () => {
          haptics.success();
          if (action === 'remove' && target.targetType === 'post') router.back();
          else setNotice(action === 'remove' ? 'Conteúdo removido.' : 'Conteúdo restaurado.');
        },
        onError: () => haptics.error(),
      },
    );

  const actions = (item: Item, targetType: Target['targetType']) => {
    const target = { targetType, targetId: item.id };
    if (reporting?.targetId === item.id) {
      return (
        <ReportPanel
          userId={userId}
          target={target}
          onCancel={() => setReporting(null)}
          onDone={() => {
            setReporting(null);
            if (targetType === 'post') router.back();
            else setNotice('Denúncia enviada. Obrigado por cuidar do clube.');
          }}
        />
      );
    }
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {item.isMine ? (
          <ActionChip
            label="Apagar"
            icon="delete-outline"
            tone="danger"
            onPress={() => confirmDelete(target)}
          />
        ) : (
          <>
            <ActionChip label="Denunciar" icon="flag" onPress={() => setReporting(target)} />
            <ActionChip
              label="Bloquear autor"
              icon="block"
              onPress={() => confirmBlock(item.author)}
            />
            {isOwner ? (
              <ActionChip
                label="Remover"
                icon="remove-circle-outline"
                tone="danger"
                onPress={() => runModeration(target, 'remove')}
              />
            ) : null}
            {isOwner && item.moderation === 'hidden' ? (
              <ActionChip
                label="Restaurar"
                icon="restore"
                onPress={() => runModeration(target, 'restore')}
              />
            ) : null}
          </>
        )}
      </View>
    );
  };

  const moderationNote = (item: Item) =>
    item.moderation === 'hidden' ? (
      <InlineMessage
        tone="info"
        message={
          item.isMine
            ? 'Oculto por denúncias: só você e o criador do clube veem isto até a revisão.'
            : 'Oculto por denúncias. Revise: remova ou restaure.'
        }
      />
    ) : item.openReportCount ? (
      <Pill
        tone="warning"
        icon="flag"
        label={item.openReportCount === 1 ? '1 denúncia' : `${item.openReportCount} denúncias`}
      />
    ) : null;

  async function send() {
    const text = body.trim();
    const pageNumber = /^\d+$/.test(pageText.trim()) ? Number(pageText.trim()) : null;
    if (!text) {
      setReplyError('Escreva sua resposta.');
      return;
    }
    if (pageNumber === null) {
      setReplyError('Informe a página de que sua resposta fala.');
      return;
    }
    setReplyError(null);
    try {
      await reply.mutateAsync({ id: replyId.current, body: text, spoilerPage: pageNumber });
      haptics.success();
      replyId.current = Crypto.randomUUID();
      setBody('');
      setPage(null);
    } catch (e) {
      haptics.error();
      setReplyError(
        e instanceof ApiError && e.code === 'RATE_LIMITED'
          ? 'Muitas respostas seguidas. Espere um minuto.'
          : e instanceof ApiError && e.code === 'VALIDATION_FAILED'
            ? 'Confira o texto e a página.'
            : 'Não foi possível responder agora.',
      );
    }
  }

  const replyCard = (item: ClubReply) => (
    <Raised
      key={item.id}
      faceColor={theme.colors.surface}
      borderColor={theme.colors.borderSoft}
      rimColor={theme.colors.cardShadow}
      radius={20}
      depth={3}
      faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Avatar name={item.author.name} size={34} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
              {item.isMine ? 'Você' : item.author.name}
            </Text>
            <Pill label={`Nív. ${item.author.level}`} />
          </View>
          <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
            {relativeTime(item.createdAt)}
          </Text>
        </View>
        <Pill
          tone={item.locked ? 'error' : 'neutral'}
          label={item.spoilerPage > 0 ? `Pág. ${item.spoilerPage}` : 'Geral'}
        />
      </View>
      {moderationNote(item)}
      {item.locked ? (
        <SpoilerVeil spoilerPage={item.spoilerPage} readerPage={readerPage} onReveal={peek} />
      ) : (
        <Text variant="body">{item.body}</Text>
      )}
      {actions(item, 'reply')}
    </Raised>
  );

  const kind = TOPIC_KIND_META[post.kind];

  return (
    <FormScreen
      title={post.isBookReview ? 'Resenha da comunidade' : 'Debate do clube'}
      eyebrow={eyebrow}
      eyebrowDot
      footer={
        <>
          {replyError ? <InlineMessage tone="error" message={replyError} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Icon name="psychology" size={16} color="accentText" />
            <Text variant="caption" color="accentText" style={{ flex: 1 }}>
              Resposta cognitiva
            </Text>
            <Text variant="label" color="textMuted" style={{ fontSize: 12 }}>
              Página
            </Text>
            <TextInput
              accessibilityLabel="Página de que sua resposta fala"
              keyboardType="number-pad"
              value={pageText}
              onChangeText={setPage}
              selectTextOnFocus
              style={{
                minWidth: 64,
                minHeight: 36,
                paddingHorizontal: theme.spacing.sm,
                borderRadius: theme.radii.md,
                borderWidth: theme.sizes.borderWidth,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                textAlign: 'center',
                fontFamily: fontFamily.bold,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
            <Avatar name={myName || 'Eu'} size={40} />
            <TextInput
              accessibilityLabel="Sua resposta"
              placeholder="Adicionar reflexão profunda…"
              placeholderTextColor={theme.colors.textMuted}
              value={body}
              onChangeText={setBody}
              maxLength={REPLY_BODY_MAX}
              multiline
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 120,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radii.pill,
                borderWidth: theme.sizes.borderWidth,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                fontFamily: fontFamily.medium,
                fontSize: 15,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar resposta"
              accessibilityState={{ busy: reply.isPending }}
              disabled={reply.isPending}
              onPress={() => void send()}
            >
              {({ pressed }) => (
                <Raised
                  faceColor={theme.colors.primary}
                  borderColor={theme.colors.primaryRim}
                  rimColor={theme.colors.primaryRim}
                  radius={theme.radii.pill}
                  depth={4}
                  pressed={pressed}
                  faceStyle={{
                    width: 48,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {reply.isPending ? (
                    <ActivityIndicator color={theme.colors.onPrimary} />
                  ) : (
                    <Icon name="arrow-forward" size={22} color="onPrimary" />
                  )}
                </Raised>
              )}
            </Pressable>
          </View>
        </>
      }
    >
      {notice ? <InlineMessage tone="success" message={notice} /> : null}

      <Raised
        faceColor={theme.colors.surface}
        borderColor={theme.colors.borderSoft}
        rimColor={theme.colors.cardShadow}
        radius={22}
        depth={theme.sizes.cardRim}
        faceStyle={{
          padding: theme.spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        <View>
          <Avatar name={post.author.name} size={56} />
          <View style={{ position: 'absolute', bottom: -6, left: 4 }}>
            <Pill tone="primarySolid" label={`Nív ${post.author.level}`} />
          </View>
        </View>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text variant="titleSm" numberOfLines={1}>
            {post.isMine ? 'Você' : post.author.name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            <Pill label={levelTitle(post.author.level)} />
            {post.isBookReview ? (
              <Pill tone="gold" icon="edit-note" label="Resenha" />
            ) : (
              <Pill tone={kind.tone} icon={kind.icon} label={kind.label} />
            )}
          </View>
        </View>
        {post.isMine ? null : friendStatus === 'accepted' ? (
          <Pill tone="success" icon="people" label="Amigos" />
        ) : friendStatus === 'outgoing' ? (
          <Pill tone="neutral" icon="schedule" label="Pedido enviado" />
        ) : friendStatus === 'incoming' ? (
          <Button
            label="Aceitar"
            icon="how-to-reg"
            size="md"
            loading={befriend.isPending}
            onPress={() => addFriend('accept')}
          />
        ) : friends.isSuccess ? (
          <Button
            label="Amizade"
            icon="person-add"
            size="md"
            loading={befriend.isPending}
            onPress={() => addFriend('request')}
          />
        ) : null}
      </Raised>

      <Raised
        faceColor={theme.colors.surfaceMuted}
        borderColor={theme.colors.primarySoft}
        rimColor={theme.colors.cardShadow}
        radius={22}
        depth={3}
        faceStyle={{
          padding: theme.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        {club.data ? (
          <BookCover
            title={club.data.book.title}
            author={club.data.book.author}
            coverUrls={club.data.book.coverUrls}
            width={48}
          />
        ) : null}
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="label" color="accentText" numberOfLines={1} style={{ flex: 1 }}>
              {club.data?.book.title ?? 'Livro do clube'}
            </Text>
            <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
              {relativeTime(post.createdAt)}
            </Text>
          </View>
          {post.reviewRating !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <StarRating value={post.reviewRating} size={15} />
              <Text variant="label" style={{ fontSize: 13 }}>
                {`${post.reviewRating}.0`}
              </Text>
              <Pill label={ratingLabel(post.reviewRating)} />
            </View>
          ) : null}
          {post.reviewTags.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {post.reviewTags.map((tag) => (
                <Pill
                  key={tag}
                  tone="neutral"
                  icon={REVIEW_TAG_META[tag].icon}
                  label={REVIEW_TAG_META[tag].label}
                />
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            <Pill
              tone="neutral"
              icon="bookmark-border"
              label={anchorLabel(post.chapter, post.spoilerPage)}
            />
            {safe ? (
              <Pill tone="success" dot label="Seguro para você" />
            ) : post.locked ? (
              <Pill
                tone="error"
                icon="visibility-off"
                label={`Spoiler (+${post.spoilerPage - readerPage} págs)`}
              />
            ) : (
              <Pill tone="warning" icon="visibility" label="Revelado por você" />
            )}
          </View>
        </View>
      </Raised>

      {moderationNote(post)}

      {post.locked ? (
        <BigVeil page={post.spoilerPage} readerPage={readerPage} onReveal={peek} />
      ) : (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.borderSoft}
          rimColor={theme.colors.cardShadow}
          radius={22}
          depth={theme.sizes.cardRim}
          faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
        >
          <Text variant="title" accessibilityRole="header" style={{ fontSize: 21, lineHeight: 28 }}>
            {post.title}
          </Text>
          <Text variant="body" color="textMuted" style={{ lineHeight: 24 }}>
            {post.body}
          </Text>
          {post.quote ? (
            <View
              style={{
                gap: theme.spacing.xs,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                borderLeftWidth: 4,
                borderLeftColor: theme.colors.primary,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.surfaceMuted,
              }}
            >
              <Text variant="bodyStrong" color="accentDeep" style={{ fontStyle: 'italic' }}>
                {`“${post.quote}”`}
              </Text>
              <Text variant="caption" color="accentText">
                {`— ${anchorLabel(post.chapter, post.spoilerPage)}`}
              </Text>
            </View>
          ) : null}
        </Raised>
      )}

      {post.locked ? null : (
        <ReactionBar
          reactions={post.reactions}
          mine={post.myReactions}
          showLabels
          disabled={post.isMine}
          onToggle={(kindId, active) =>
            react.mutate({ targetType: 'post', targetId: post.id, kind: kindId, active })
          }
        />
      )}
      {actions(post, 'post')}

      <SectionTitle
        icon="forum"
        title={replies.length === 1 ? '1 resposta' : `${replies.length} respostas`}
        subtitle="Cada resposta tem pelo menos a página do debate"
      />
      {replies.length === 0 ? (
        <Text variant="body" color="textMuted">
          Ninguém respondeu ainda. Traga um argumento da obra.
        </Text>
      ) : (
        replies.map(replyCard)
      )}
    </FormScreen>
  );
}
