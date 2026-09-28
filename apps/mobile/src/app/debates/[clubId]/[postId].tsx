import { REPLY_BODY_MAX } from '@bubo/contracts';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  InlineMessage,
  LinkButton,
  SectionHeader,
  Text,
  TextField,
} from '../../../design-system';
import { relativeTime } from '../../../features/community/meta';
import { ReportPanel } from '../../../features/community/ReportPanel';
import { SpoilerLock } from '../../../features/community/SpoilerLock';
import { ApiError } from '../../../lib/api/client';
import {
  useBlockUser,
  useClub,
  useClubTopic,
  useCreateClubReply,
  useDeleteClubContent,
  useModerateClubContent,
} from '../../../lib/api/queries';
import { useAuthState } from '../../../lib/auth/session';
import { haptics } from '../../../lib/haptics';
import { useTheme } from '../../../theme';

type Target = { targetType: 'post' | 'reply'; targetId: string };

type Item = {
  id: string;
  author: { id: string; name: string };
  isMine: boolean;
  moderation: 'visible' | 'hidden';
  openReportCount: number | null;
};

/** Author row + moderation state shared by the topic and its replies. */
function ItemHeader({ item, createdAt, page }: { item: Item; createdAt: string; page: number }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Avatar name={item.author.name} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="label" numberOfLines={1}>
            {item.isMine ? 'Você' : item.author.name}
          </Text>
          <Text variant="bodySm" color="textMuted">
            {relativeTime(createdAt)}
          </Text>
        </View>
        <Chip label={page > 0 ? `Pág. ${page}` : 'Geral'} tone="primary" />
      </View>
      {item.moderation === 'hidden' ? (
        <InlineMessage
          tone="info"
          message={
            item.isMine
              ? 'Oculto por denúncias: só você e o criador do clube veem isto até a revisão.'
              : 'Oculto por denúncias. Revise: remova ou restaure.'
          }
        />
      ) : item.openReportCount ? (
        <Chip
          label={item.openReportCount === 1 ? '1 denúncia' : `${item.openReportCount} denúncias`}
          tone="orange"
          icon="flag"
        />
      ) : null}
    </View>
  );
}

/**
 * One debate (Stitch forum). The author deletes their content; others report or block; the club
 * owner removes or restores. Locked text never arrives until the reader chooses to peek.
 */
export default function TopicScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId: string; postId: string; reveal?: string }>();
  const clubId = typeof params.clubId === 'string' ? params.clubId : '';
  const postId = typeof params.postId === 'string' ? params.postId : '';
  const reveal = params.reveal === '1';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';

  const club = useClub(userId || undefined, clubId);
  const topic = useClubTopic(userId || undefined, clubId, postId, reveal);
  const reply = useCreateClubReply(userId, clubId, postId);
  const remove = useDeleteClubContent(userId, clubId);
  const moderate = useModerateClubContent(userId, clubId);
  const block = useBlockUser(userId);

  const replyId = useRef(Crypto.randomUUID());
  const [body, setBody] = useState('');
  const [page, setPage] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Target | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isOwner = club.data?.membership === 'owner';
  const title = club.data?.name ?? 'Debate';

  if (topic.isPending) {
    return (
      <FormScreen title="Debate" eyebrow={title}>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando debate" />
      </FormScreen>
    );
  }
  if (topic.isError) {
    const gone = topic.error instanceof ApiError && topic.error.code === 'NOT_FOUND';
    return (
      <FormScreen title="Debate" eyebrow={title}>
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.spacing.md }}>
        {item.isMine ? (
          <LinkButton
            label="Apagar"
            color="error"
            align="left"
            onPress={() => confirmDelete(target)}
          />
        ) : (
          <>
            <LinkButton label="Denunciar" align="left" onPress={() => setReporting(target)} />
            <LinkButton
              label="Bloquear autor"
              align="left"
              color="textMuted"
              onPress={() => confirmBlock(item.author)}
            />
            {isOwner ? (
              <LinkButton
                label="Remover"
                color="error"
                align="left"
                onPress={() => runModeration(target, 'remove')}
              />
            ) : null}
            {isOwner && item.moderation === 'hidden' ? (
              <LinkButton
                label="Restaurar"
                align="left"
                onPress={() => runModeration(target, 'restore')}
              />
            ) : null}
          </>
        )}
      </View>
    );
  };

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

  return (
    <FormScreen
      title="Debate"
      eyebrow={title}
      footer={
        <>
          {replyError ? <InlineMessage tone="error" message={replyError} /> : null}
          <TextField
            label="Sua resposta"
            hideLabel
            placeholder="Responder ao debate"
            value={body}
            onChangeText={setBody}
            maxLength={REPLY_BODY_MAX}
            multiline
          />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
            <View style={{ width: 120 }}>
              <TextField
                label="Página"
                keyboardType="number-pad"
                value={pageText}
                onChangeText={setPage}
              />
            </View>
            <Button
              label="Responder"
              icon="send"
              loading={reply.isPending}
              onPress={send}
              style={{ flex: 1 }}
            />
          </View>
        </>
      }
    >
      {notice ? <InlineMessage tone="success" message={notice} /> : null}

      <Card>
        <ItemHeader item={post} createdAt={post.createdAt} page={post.spoilerPage} />
        {post.locked ? (
          <SpoilerLock spoilerPage={post.spoilerPage} readerPage={readerPage} onPeek={peek} />
        ) : (
          <>
            <Text variant="title" accessibilityRole="header">
              {post.title}
            </Text>
            <Text variant="body">{post.body}</Text>
          </>
        )}
        {actions(post, 'post')}
      </Card>

      <SectionHeader
        title={replies.length === 1 ? '1 resposta' : `${replies.length} respostas`}
        icon="forum"
      />
      {replies.length === 0 ? (
        <Text variant="body" color="textMuted">
          Ninguém respondeu ainda. A resposta herda no mínimo a página do debate.
        </Text>
      ) : (
        replies.map((item) => (
          <Card key={item.id}>
            <ItemHeader item={item} createdAt={item.createdAt} page={item.spoilerPage} />
            {item.locked ? (
              <SpoilerLock spoilerPage={item.spoilerPage} readerPage={readerPage} onPeek={peek} />
            ) : (
              <Text variant="body">{item.body}</Text>
            )}
            {actions(item, 'reply')}
          </Card>
        ))
      )}
    </FormScreen>
  );
}
