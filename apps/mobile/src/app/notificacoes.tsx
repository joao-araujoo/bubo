import { type AppNotification } from '@bubo/contracts';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import {
  Avatar,
  BuboMascot,
  BuboTip,
  Button,
  EmptyState,
  FormScreen,
  Icon,
  IconTile,
  type IconTileTone,
  InlineMessage,
  Pill,
  Raised,
  SectionTitle,
  TabChip,
  Text,
} from '../design-system';
import { relativeTime } from '../features/community/meta';
import { estimatedMinutes } from '../features/recall/grades';
import {
  useChangeFriend,
  useDueCards,
  useMarkNotificationsRead,
  useNotifications,
} from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

type Filter = 'all' | 'memory' | 'community';
type Group = 'today' | 'week' | 'older';

const GROUP_TITLE: Record<Group, string> = {
  today: 'Hoje',
  week: 'Esta semana',
  older: 'Antes',
};

function groupOf(iso: string, now = new Date()): Group {
  const then = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (then.getTime() >= startOfToday) return 'today';
  return then.getTime() >= startOfToday - 6 * 86_400_000 ? 'week' : 'older';
}

/** Icon, tone and caps label of each kind (Stitch coloured eyebrows). */
const KIND_META: Record<
  AppNotification['kind'],
  { icon: Parameters<typeof IconTile>[0]['icon']; tone: IconTileTone; label: string }
> = {
  review_due: { icon: 'psychology', tone: 'primary', label: 'Lembrete de revisão' },
  topic_reply: { icon: 'forum', tone: 'blue', label: 'Resposta' },
  friend_request: { icon: 'person-add', tone: 'primary', label: 'Pedido de amizade' },
  friend_accepted: { icon: 'people', tone: 'success', label: 'Amizade aceita' },
  cycle_started: { icon: 'history', tone: 'gold', label: 'Novo ciclo' },
};

function Bold({ children }: { children: string }) {
  return (
    <Text variant="bodyStrong" color="accentText">
      {children}
    </Text>
  );
}

/** One sentence per kind, built only from names, titles and counts (never content). */
function Sentence({ item }: { item: AppNotification }) {
  const actor = item.actor?.name ?? 'Um leitor';
  const others = (item.count ?? 1) - 1;
  switch (item.kind) {
    case 'review_due':
      return (
        <Text variant="body">
          {item.count === 1 ? '1 lembrança venceu' : `${item.count ?? 0} lembranças venceram`} e
          estavam esperando por você.
        </Text>
      );
    case 'topic_reply':
      return (
        <Text variant="body">
          <Bold>{actor}</Bold>
          {others > 0 ? ` e mais ${others} ${others === 1 ? 'pessoa' : 'pessoas'}` : ''}
          {` ${others > 0 ? 'responderam' : 'respondeu'} à sua ${item.post?.isReview ? 'resenha' : 'discussão'}`}
          {item.post ? (
            <>
              {' '}
              <Bold>{`“${item.post.title}”`}</Bold>
            </>
          ) : null}
          .
        </Text>
      );
    case 'friend_request':
      return (
        <Text variant="body">
          <Bold>{actor}</Bold> quer ser seu amigo de leitura.
        </Text>
      );
    case 'friend_accepted':
      return (
        <Text variant="body">
          Você e <Bold>{actor}</Bold> agora são amigos de leitura.
        </Text>
      );
    case 'cycle_started':
      return (
        <Text variant="body">
          Novo ciclo em <Bold>{item.club?.name ?? 'seu clube'}</Bold>: {item.count ?? 0} páginas por
          pessoa.
        </Text>
      );
  }
}

function NotificationCard({
  item,
  userId,
  onOpen,
}: {
  item: AppNotification;
  userId: string;
  onOpen: (item: AppNotification, path: Href) => void;
}) {
  const theme = useTheme();
  const friend = useChangeFriend(userId);
  const meta = KIND_META[item.kind];
  const [answered, setAnswered] = useState<'accept' | 'remove' | null>(null);

  const action: { label: string; path: Href } | null =
    item.kind === 'review_due'
      ? { label: 'Revisar', path: '/revisar' }
      : item.kind === 'topic_reply' && item.post && item.club
        ? {
            label: item.post.isReview ? 'Ver resenha' : 'Ver discussão',
            path: {
              pathname: item.post.isReview
                ? '/resenhas/[clubId]/[postId]'
                : '/debates/[clubId]/[postId]',
              params: { clubId: item.club.id, postId: item.post.id },
            },
          }
        : item.kind === 'cycle_started' && item.club
          ? {
              label: 'Ver ciclo',
              path: { pathname: '/ciclos/[clubId]', params: { clubId: item.club.id } },
            }
          : item.kind === 'friend_accepted'
            ? { label: 'Ver amigos', path: '/amigos' }
            : null;

  const answer = (choice: 'accept' | 'remove') => {
    if (!item.actor || friend.isPending) return;
    friend.mutate(
      { otherId: item.actor.id, action: choice },
      {
        onSuccess: () => {
          haptics.success();
          setAnswered(choice);
        },
        onError: () => haptics.error(),
      },
    );
  };

  return (
    <Raised
      faceColor={theme.colors.surface}
      borderColor={item.read ? theme.colors.borderSoft : theme.colors.purpleLight}
      rimColor={item.read ? theme.colors.cardShadow : theme.colors.primarySoft}
      radius={22}
      depth={theme.sizes.cardRim}
      faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        {item.actor ? (
          <View>
            <Avatar name={item.actor.name} size={44} />
            <View style={{ position: 'absolute', right: -4, bottom: -4 }}>
              <IconTile icon={meta.icon} tone={meta.tone} size={22} solid round />
            </View>
          </View>
        ) : (
          <IconTile icon={meta.icon} tone={meta.tone} size={44} />
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="caption" color="accentText" style={{ flex: 1 }}>
              {meta.label}
            </Text>
            <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
              {relativeTime(item.createdAt)}
            </Text>
            {item.read ? null : (
              <View
                accessibilityLabel="Não lida"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: theme.colors.primary,
                }}
              />
            )}
          </View>
          <Sentence item={item} />
          {item.club && item.kind === 'topic_reply' ? (
            <Text variant="bodySm" color="textMuted">
              {item.club.name}
            </Text>
          ) : null}
        </View>
      </View>
      {item.kind === 'friend_request' ? (
        answered ? (
          <Pill
            tone={answered === 'accept' ? 'success' : 'neutral'}
            icon={answered === 'accept' ? 'people' : 'close'}
            label={answered === 'accept' ? 'Amizade aceita' : 'Pedido recusado'}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Aceitar"
                icon="how-to-reg"
                size="md"
                fullWidth
                loading={friend.isPending && friend.variables?.action === 'accept'}
                onPress={() => answer('accept')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Recusar"
                variant="secondary"
                size="md"
                fullWidth
                disabled={friend.isPending}
                onPress={() => answer('remove')}
              />
            </View>
          </View>
        )
      ) : null}
      {friend.isError ? (
        <InlineMessage tone="error" message="Não foi possível responder agora." />
      ) : null}
      {action ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Button
            label={action.label}
            icon="chevron-right"
            variant="secondary"
            size="md"
            compact
            onPress={() => onOpen(item, action.path)}
          />
        </View>
      ) : null}
    </Raised>
  );
}

/**
 * Stitch "Notificações & alertas cognitivos" + "Notificações do clube": the reader's inbox. The
 * "Hora de revisar" card uses the live due count, so it never asks for a review that is done.
 */
export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const inbox = useNotifications(userId || undefined);
  const due = useDueCards(userId || undefined);
  const markRead = useMarkNotificationsRead(userId);
  const [filter, setFilter] = useState<Filter>('all');

  const items = inbox.data?.items ?? [];
  const unread = inbox.data?.unreadCount ?? 0;
  const memory = items.filter((item) => item.kind === 'review_due');
  const community = items.filter((item) => item.kind !== 'review_due');
  const visible = filter === 'memory' ? memory : filter === 'community' ? community : items;
  const dueNow = due.data ? Math.min(due.data.dueCount, due.data.cards.length) : 0;
  const pendingRequests = community.filter((item) => item.kind === 'friend_request').length;
  const unreadReplies = community.filter(
    (item) => item.kind === 'topic_reply' && !item.read,
  ).length;

  const open = (item: AppNotification, path: Href) => {
    if (!item.read) markRead.mutate({ ids: [item.id] });
    router.push(path);
  };

  const groups = (['today', 'week', 'older'] as const)
    .map((group) => ({ group, list: visible.filter((item) => groupOf(item.createdAt) === group) }))
    .filter((entry) => entry.list.length > 0);

  return (
    <FormScreen
      align="left"
      eyebrow="Alertas cognitivos & comunidade"
      eyebrowDot
      title="Notificações"
      headerRight={
        unread > 0 ? (
          <Button
            label="Lidas"
            icon="done-all"
            variant="secondary"
            size="md"
            compact
            loading={markRead.isPending}
            onPress={() => markRead.mutate({ all: true }, { onSuccess: () => haptics.success() })}
          />
        ) : null
      }
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        style={{ marginHorizontal: -theme.sizes.gutter }}
        contentContainerStyle={{
          gap: theme.spacing.sm,
          paddingHorizontal: theme.sizes.gutter,
          paddingBottom: 2,
        }}
      >
        <TabChip
          label="Todas"
          count={unread || undefined}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <TabChip
          label="Memória"
          icon="psychology"
          selected={filter === 'memory'}
          onPress={() => setFilter('memory')}
        />
        <TabChip
          label="Comunidade"
          icon="groups"
          selected={filter === 'community'}
          onPress={() => setFilter('community')}
        />
      </ScrollView>

      {dueNow > 0 && filter !== 'community' ? (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.gold}
          rimColor={theme.colors.goldRim}
          radius={22}
          depth={theme.sizes.cardRim}
          faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
        >
          <View style={{ flexDirection: 'row' }}>
            <Pill tone="warning" icon="warning-amber" caps label="Hora de revisar" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <BuboMascot state="reviewDue" size={64} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="titleSm">Suas lembranças estão esperando</Text>
              <Text variant="bodySm" color="textMuted">
                {`${dueNow === 1 ? '1 lembrança para hoje' : `${dueNow} lembranças para hoje`}. Leva cerca de ${estimatedMinutes(dueNow)} min.`}
              </Text>
            </View>
          </View>
          <Button
            label="Revisar agora"
            icon="arrow-forward"
            fullWidth
            onPress={() => router.push('/revisao')}
          />
        </Raised>
      ) : null}

      {inbox.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando avisos" />
      ) : inbox.isError ? (
        <>
          <InlineMessage tone="error" message="Não foi possível carregar suas notificações." />
          <Button label="Tentar de novo" icon="refresh" onPress={() => void inbox.refetch()} />
        </>
      ) : (
        <>
          {filter !== 'memory' && (pendingRequests > 0 || unreadReplies > 0) ? (
            <BuboTip
              state="emptyCommunity"
              title="Guardião Bubo"
              titleIcon="shield"
              trailing={<Pill tone="success" label="Anti-spoiler ativo" />}
            >
              <Text variant="bodySm">
                {[
                  pendingRequests
                    ? pendingRequests === 1
                      ? '1 pedido de amizade'
                      : `${pendingRequests} pedidos de amizade`
                    : null,
                  unreadReplies
                    ? unreadReplies === 1
                      ? '1 discussão com resposta nova'
                      : `${unreadReplies} discussões com respostas novas`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' e ')}
                . Os avisos nunca mostram trechos: ao abrir, o véu respeita a sua página.
              </Text>
            </BuboTip>
          ) : null}
          {groups.length === 0 ? (
            <EmptyState
              mascot={filter === 'memory' ? 'emptyReview' : 'emptyCommunity'}
              title="Tudo em dia"
              description={
                filter === 'memory'
                  ? 'Os lembretes de revisão aparecem aqui quando você os ativa em Preferências.'
                  : 'Respostas às suas discussões, pedidos de amizade e novos ciclos dos clubes aparecem aqui.'
              }
              action={
                <Button
                  label="Preferências de aviso"
                  icon="tune"
                  variant="secondary"
                  onPress={() => router.push('/configuracoes')}
                />
              }
            />
          ) : (
            groups.map(({ group, list }) => (
              <View key={group} style={{ gap: theme.spacing.md }}>
                <SectionTitle title={GROUP_TITLE[group]} />
                {list.map((item) => (
                  <NotificationCard key={item.id} item={item} userId={userId} onOpen={open} />
                ))}
              </View>
            ))
          )}
        </>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        <Icon name="info-outline" size={16} color="textMuted" />
        <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
          Mostramos os últimos 50 avisos.
        </Text>
      </View>
    </FormScreen>
  );
}
