import { type FriendsFeed, type FriendsResponse } from '@bubo/contracts';
import { readingProgress } from '@bubo/domain';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

import {
  Avatar,
  BuboTip,
  Button,
  Card,
  EmptyState,
  FormScreen,
  Icon,
  InlineMessage,
  Pill,
  Raised,
  SectionTitle,
  SegmentedTabs,
  Text,
  Toggle,
  initialsOf,
} from '../design-system';
import { ActionChip } from '../features/community/ActionChip';
import { pagesLabel, relativeTime } from '../features/community/meta';
import {
  useBlockUser,
  useChangeFriend,
  useFriends,
  useFriendsFeed,
  useSaveSocialPreferences,
} from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

type Segment = 'feed' | 'friends' | 'privacy';
type Friend = FriendsResponse['friends'][number];

/** Stitch "Lendo agora • círculo ativo": squircle initials with the friend's real progress. */
function ReadingNowRow({ items }: { items: FriendsFeed['readingNow'] }) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -theme.sizes.gutter }}
      contentContainerStyle={{ gap: theme.spacing.md, paddingHorizontal: theme.sizes.gutter }}
    >
      {items.map((item) => {
        const percent = item.totalPages
          ? readingProgress(item.currentPage, item.totalPages).percent
          : null;
        return (
          <View
            key={item.userId}
            accessible
            accessibilityLabel={`${item.name} está lendo ${item.bookTitle}${percent !== null ? `, ${percent}%` : `, página ${item.currentPage}`}`}
            style={{ width: 76, alignItems: 'center', gap: 4 }}
          >
            <View>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: theme.colors.purpleLight,
                  backgroundColor: theme.colors.primarySoft,
                }}
              >
                <Text variant="titleSm" color="accentText">
                  {initialsOf(item.name)}
                </Text>
              </View>
              <View style={{ position: 'absolute', right: -6, bottom: -6 }}>
                <Pill
                  tone="primarySolid"
                  label={percent !== null ? `${percent}%` : `p. ${item.currentPage}`}
                />
              </View>
            </View>
            <Text variant="label" numberOfLines={1} style={{ fontSize: 12 }}>
              {item.name.split(' ')[0]}
            </Text>
            <Text variant="bodySm" color="accentText" numberOfLines={1} style={{ fontSize: 11 }}>
              {item.bookTitle}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

/** Stitch friend activity card: who, when, the book and page, focus minutes and pages. */
function ActivityCard({ item }: { item: FriendsFeed['items'][number] }) {
  const theme = useTheme();
  return (
    <Raised
      faceColor={theme.colors.surface}
      borderColor={theme.colors.borderSoft}
      rimColor={theme.colors.cardShadow}
      radius={22}
      depth={theme.sizes.cardRim}
      faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Avatar name={item.name} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={2}>
            {`${relativeTime(item.endedAt)} • Lendo `}
            <Text variant="label" color="accentText">
              {item.bookTitle}
            </Text>
            {` (pág. ${item.endPage})`}
          </Text>
        </View>
        <Pill tone="success" dot label="Sessão" />
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderLeftWidth: 4,
          borderLeftColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="timer" size={18} color="accentText" />
          <Text variant="label">
            {item.minutes === 1 ? '1 min de foco' : `${item.minutes} min de foco`}
          </Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="auto-stories" size={18} color="accentText" />
          <Text variant="label">{pagesLabel(item.pages)}</Text>
        </View>
      </View>
    </Raised>
  );
}

/**
 * Stitch "Feed de amigos". Friends need mutual consent and share nothing until they turn sharing
 * on; only catalog books, focus minutes and pages are ever shown — never reflections or recall.
 */
export default function FriendsScreen() {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const list = useFriends(userId);
  const feed = useFriendsFeed(userId);
  const change = useChangeFriend(userId ?? '');
  const preferences = useSaveSocialPreferences(userId ?? '');
  const block = useBlockUser(userId ?? '');
  const [segment, setSegment] = useState<Segment>('feed');
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const friends = list.data?.friends ?? [];
  const incoming = friends.filter((friend) => friend.status === 'incoming');
  const accepted = friends.filter((friend) => friend.status === 'accepted');
  const outgoing = friends.filter((friend) => friend.status === 'outgoing');

  const run = (friend: Friend, action: 'accept' | 'remove', done: string) =>
    change.mutate(
      { otherId: friend.userId, action },
      {
        onSuccess: () => {
          haptics.success();
          setFailure(null);
          setNotice(done);
        },
        onError: () => {
          haptics.error();
          setFailure('Não foi possível concluir. Atualize e tente de novo.');
        },
      },
    );

  const confirmRemove = (friend: Friend) =>
    Alert.alert(
      friend.status === 'accepted'
        ? `Desfazer amizade com ${friend.name}?`
        : friend.status === 'incoming'
          ? `Recusar o pedido de ${friend.name}?`
          : `Cancelar o pedido para ${friend.name}?`,
      'Vocês deixam de ver a atividade compartilhada um do outro.',
      [
        { text: 'Manter', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: () => run(friend, 'remove', 'Pronto, atualizamos seus amigos.'),
        },
      ],
    );

  const confirmBlock = (friend: Friend) =>
    Alert.alert(
      `Bloquear ${friend.name}?`,
      'A amizade é desfeita e vocês não veem mais os conteúdos um do outro nos clubes. Você pode desbloquear em Você → Leitores bloqueados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () =>
            block.mutate(friend.userId, {
              onSuccess: () => {
                haptics.success();
                setNotice(`${friend.name} foi bloqueado.`);
              },
              onError: () => {
                haptics.error();
                setFailure('Não foi possível bloquear agora.');
              },
            }),
        },
      ],
    );

  const savePreferences = (next: FriendsResponse['preferences']) => {
    if (preferences.isPending) return;
    preferences.mutate(next, {
      onSuccess: () => {
        haptics.success();
        setFailure(null);
      },
      onError: () => {
        haptics.error();
        setFailure('Não foi possível salvar sua privacidade.');
      },
    });
  };

  const friendRow = (friend: Friend) => (
    <Card key={friend.userId}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Avatar name={friend.name} size={44} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {friend.name}
          </Text>
          {friend.status === 'accepted' ? (
            <Pill tone="success" icon="people" label="Amigos de leitura" />
          ) : friend.status === 'incoming' ? (
            <Pill tone="primary" icon="mail-outline" label="Quer ler junto com você" />
          ) : (
            <Pill tone="neutral" icon="schedule" label="Pedido enviado" />
          )}
        </View>
      </View>
      {friend.status === 'incoming' ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Aceitar"
              icon="how-to-reg"
              size="md"
              fullWidth
              disabled={change.isPending}
              onPress={() =>
                run(friend, 'accept', `Agora você e ${friend.name} são amigos de leitura.`)
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Recusar"
              variant="secondary"
              size="md"
              fullWidth
              disabled={change.isPending}
              onPress={() => confirmRemove(friend)}
            />
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {friend.status !== 'incoming' ? (
          <ActionChip
            label={friend.status === 'accepted' ? 'Desfazer amizade' : 'Cancelar pedido'}
            icon="remove-circle-outline"
            onPress={() => confirmRemove(friend)}
          />
        ) : null}
        <ActionChip
          label="Bloquear"
          icon="block"
          tone="danger"
          onPress={() => confirmBlock(friend)}
        />
      </View>
    </Card>
  );

  const loading = (label: string) => (
    <ActivityIndicator color={theme.colors.primary} accessibilityLabel={label} />
  );

  return (
    <FormScreen
      align="left"
      eyebrow="Social"
      eyebrowDot
      title="Feed de amigos"
      headerRight={
        <Pill
          tone="primary"
          icon="lock-outline"
          label={list.data?.preferences.shareActivity ? 'Compartilhando' : 'Privado'}
        />
      }
    >
      <SegmentedTabs
        accessibilityLabel="Seções de amigos"
        value={segment}
        onChange={setSegment}
        options={[
          { id: 'feed', label: 'Atividade' },
          {
            id: 'friends',
            label: 'Amigos',
            count: list.data ? accepted.length + incoming.length : undefined,
          },
          { id: 'privacy', label: 'Privacidade' },
        ]}
      />
      {notice ? <InlineMessage tone="success" message={notice} /> : null}
      {failure ? <InlineMessage tone="error" message={failure} /> : null}

      {segment === 'feed' ? (
        feed.isPending ? (
          loading('Carregando leituras dos amigos')
        ) : feed.isError ? (
          <>
            <InlineMessage tone="error" message="Não foi possível carregar o feed de amigos." />
            <Button label="Tentar de novo" icon="refresh" onPress={() => void feed.refetch()} />
          </>
        ) : (
          <>
            {incoming.length ? (
              <Card tone="muted">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Icon name="mail-outline" size={20} color="accentText" />
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {incoming.length === 1
                      ? '1 pedido de amizade'
                      : `${incoming.length} pedidos de amizade`}
                  </Text>
                  <Button label="Ver" size="md" compact onPress={() => setSegment('friends')} />
                </View>
              </Card>
            ) : null}
            {feed.data.readingNow.length ? (
              <>
                <SectionTitle
                  icon="auto-stories"
                  title="Lendo agora • círculo ativo"
                  trailing={<Pill tone="success" dot label={String(feed.data.readingNow.length)} />}
                />
                <ReadingNowRow items={feed.data.readingNow} />
              </>
            ) : null}
            <SectionTitle
              icon="history"
              title="Sessões recentes"
              subtitle="Só livros do catálogo, minutos e páginas. Reflexões são sempre privadas."
            />
            {feed.data.items.length === 0 ? (
              <EmptyState
                mascot="emptyCommunity"
                title={accepted.length ? 'Nada compartilhado ainda' : 'Leituras também aproximam'}
                description={
                  accepted.length
                    ? 'Quando seus amigos ativarem o compartilhamento, as próximas sessões deles aparecem aqui.'
                    : 'Abra um clube → Membros e envie um pedido de amizade. A outra pessoa escolhe se aceita.'
                }
              />
            ) : (
              feed.data.items.map((item) => <ActivityCard key={item.id} item={item} />)
            )}
          </>
        )
      ) : null}

      {segment === 'friends' ? (
        list.isPending ? (
          loading('Carregando amigos')
        ) : list.isError ? (
          <>
            <InlineMessage tone="error" message="Não foi possível carregar seus amigos." />
            <Button label="Tentar de novo" icon="refresh" onPress={() => void list.refetch()} />
          </>
        ) : friends.length === 0 ? (
          <EmptyState
            mascot="emptyCommunity"
            title="Ainda sem amigos de leitura"
            description="Pedidos só podem ser enviados para quem está em um clube com você: abra um clube → Membros."
          />
        ) : (
          <>
            {incoming.length ? (
              <>
                <SectionTitle icon="mail-outline" title="Pedidos recebidos" />
                {incoming.map(friendRow)}
              </>
            ) : null}
            {accepted.length ? (
              <>
                <SectionTitle icon="people" title="Seus amigos" />
                {accepted.map(friendRow)}
              </>
            ) : null}
            {outgoing.length ? (
              <>
                <SectionTitle icon="schedule" title="Pedidos enviados" />
                {outgoing.map(friendRow)}
              </>
            ) : null}
          </>
        )
      ) : null}

      {segment === 'privacy' ? (
        list.isPending ? (
          loading('Carregando sua privacidade')
        ) : list.isError ? (
          <InlineMessage tone="error" message="Não foi possível carregar sua privacidade." />
        ) : (
          <>
            <BuboTip state="profile" title="Você no controle">
              <Text variant="bodySm">
                Nada é compartilhado sem a sua escolha. Ao ativar, seus amigos veem o livro que você
                está lendo e as sessões a partir de agora; desativar esconde tudo na hora.
              </Text>
            </BuboTip>
            <Card>
              <Toggle
                icon="person-add"
                title="Receber pedidos de amizade"
                description="Somente de pessoas dos seus clubes. Desativar também recusa os pedidos pendentes."
                value={list.data.preferences.allowRequests}
                onValueChange={(value) =>
                  savePreferences({ ...list.data.preferences, allowRequests: value })
                }
              />
              <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />
              <Toggle
                icon="visibility"
                title="Compartilhar minhas leituras"
                description="Amigos aceitos veem o livro de catálogo que você está lendo, a página e as próximas sessões (minutos e páginas). Reflexões e respostas de memória nunca são compartilhadas."
                value={list.data.preferences.shareActivity}
                onValueChange={(value) =>
                  savePreferences({ ...list.data.preferences, shareActivity: value })
                }
              />
            </Card>
          </>
        )
      ) : null}
    </FormScreen>
  );
}
