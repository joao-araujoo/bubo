import { type ClubSummary } from '@bubo/contracts';
import { normalizeInviteCode } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import {
  BuboLogo,
  BuboTip,
  Button,
  EmptyState,
  HeaderButton,
  Icon,
  InlineMessage,
  Pill,
  Raised,
  Screen,
  SegmentedTabs,
  TabChip,
  Text,
  TextField,
} from '../../design-system';
import { useDebouncedValue } from '../../features/catalog/catalog';
import { ClubChip } from '../../features/community/ClubChip';
import { ClubExploreCard } from '../../features/community/ClubExploreCard';
import { pagesLabel } from '../../features/community/meta';
import { PollCard } from '../../features/community/PollCard';
import { TopicCard } from '../../features/community/TopicCard';
import { useClubs, useCommunityFeed, useJoinClub, useSetReaction } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type Segment = 'feed' | 'mine' | 'discover';
type Filter = 'all' | 'shelf' | 'goal' | 'active';

const FILTERS: {
  id: Filter;
  label: string;
  icon: 'apps' | 'bookmark' | 'speed' | 'local-fire-department';
}[] = [
  { id: 'all', label: 'Todos', icon: 'apps' },
  { id: 'shelf', label: 'Na sua estante', icon: 'bookmark' },
  { id: 'goal', label: 'Com meta semanal', icon: 'speed' },
  { id: 'active', label: 'Mais ativos', icon: 'local-fire-department' },
];

function Header({
  onSearch,
  onCreate,
  onFriends,
}: {
  onSearch: () => void;
  onCreate: () => void;
  onFriends: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.borderSoft,
          backgroundColor: theme.colors.primarySoft,
        }}
      >
        <BuboLogo variant="symbol" height={28} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Pill caps label="Clubes" />
        <Text variant="title" accessibilityRole="header" numberOfLines={1}>
          Comunidade
        </Text>
      </View>
      <HeaderButton
        icon="people"
        label="Amigos de leitura"
        shape="square"
        iconColor="accentText"
        onPress={onFriends}
      />
      <HeaderButton
        icon="search"
        label="Buscar clubes"
        shape="square"
        iconColor="accentText"
        onPress={onSearch}
      />
      <Button label="Clube" icon="add" size="md" compact onPress={onCreate} />
    </View>
  );
}

/** Stitch "Debate protegido" feed card: what is waiting further in the book, without any text. */
function ProtectedCard({
  page,
  readerPage,
  bookTitle,
  onContinue,
}: {
  page: number;
  readerPage: number;
  bookTitle: string;
  onContinue: () => void;
}) {
  const theme = useTheme();
  return (
    <Raised
      faceColor={theme.colors.surface}
      borderColor={theme.colors.borderSoft}
      rimColor={theme.colors.cardShadow}
      radius={20}
      depth={theme.sizes.cardRim}
      faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Icon name="lock-outline" size={18} color="textMuted" />
        <Text variant="label" style={{ flex: 1 }}>
          Debate protegido
        </Text>
        <Pill tone="neutral" caps label={`Pág. ${page}`} />
      </View>
      <Text variant="bodySm" color="textMuted" style={{ fontStyle: 'italic' }}>
        {`Este debate fala da página ${page} de ${bookTitle}. O Bubo revela o conteúdo assim que você registrar a leitura até lá.`}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="label" color="accentText" style={{ flex: 1, fontSize: 13 }}>
          {`Faltam ${pagesLabel(Math.max(0, page - readerPage))}`}
        </Text>
        <Pressable accessibilityRole="button" onPress={onContinue} hitSlop={10}>
          <Text variant="label" color="accentText" style={{ fontSize: 13 }}>
            {`Abrir clube ›`}
          </Text>
        </Pressable>
      </View>
    </Raised>
  );
}

/** Comunidade (Stitch "Feed dos clubes" + "Explorar clubes"), Tasks 07–08. */
export default function CommunityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const [segment, setSegment] = useState<Segment>('feed');
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const q = useDebouncedValue(text.trim());
  const clubs = useClubs(userId || undefined, segment === 'discover' ? q : '');
  const feed = useCommunityFeed(userId || undefined, segment === 'feed');
  const react = useSetReaction(userId);
  const join = useJoinClub(userId);

  const mine = clubs.data?.mine ?? [];
  const openClub = (id: string, tab?: 'enquetes') =>
    router.push({ pathname: '/clubes/[id]', params: tab ? { id, tab } : { id } });
  const create = () => router.push('/clubes/novo');

  const discover = useMemo(() => {
    const list = clubs.data?.discover ?? [];
    if (filter === 'shelf') return list.filter((club) => club.onMyShelf);
    if (filter === 'goal') return list.filter((club) => club.weeklyGoalPages !== null);
    if (filter === 'active') return [...list].sort((a, b) => b.topicCount - a.topicCount);
    return list;
  }, [clubs.data, filter]);
  const affinity = (clubs.data?.discover ?? []).filter((club) => club.onMyShelf);

  function openInvite() {
    const normalized = normalizeInviteCode(code);
    if (!normalized) {
      setCodeError('Use os 8 caracteres do convite, por exemplo ABCD-2345.');
      return;
    }
    setCodeError(null);
    router.push({ pathname: '/convite/[code]', params: { code: normalized } });
  }

  const joinFromList = (club: ClubSummary) => {
    setJoiningId(club.id);
    join.mutate(club.id, {
      onSuccess: () => {
        haptics.success();
        openClub(club.id);
      },
      onError: () => haptics.error(),
      onSettled: () => setJoiningId(null),
    });
  };

  const loading = (
    <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando" />
  );

  return (
    <Screen
      header={
        <View style={{ gap: theme.spacing.md }}>
          <Header
            onSearch={() => setSegment('discover')}
            onCreate={create}
            onFriends={() => router.push('/amigos')}
          />
          <SegmentedTabs
            accessibilityLabel="Seções da comunidade"
            value={segment}
            onChange={setSegment}
            options={[
              { id: 'feed', label: 'Feed Geral' },
              { id: 'mine', label: 'Seus Clubes', count: clubs.data ? mine.length : undefined },
              { id: 'discover', label: 'Descobrir' },
            ]}
          />
        </View>
      }
    >
      {segment === 'feed' ? (
        feed.isPending || clubs.isPending ? (
          loading
        ) : feed.isError ? (
          <InlineMessage tone="error" message="Não foi possível carregar o feed agora." />
        ) : mine.length === 0 ? (
          <>
            <BuboTip state="emptyCommunity" title="Clubes sem spoiler">
              Cada debate diz a página de que fala. O que estiver à frente da sua leitura fica
              coberto até você chegar lá.
            </BuboTip>
            <Button
              label="Descobrir clubes"
              icon="explore"
              fullWidth
              onPress={() => setSegment('discover')}
            />
            <Button
              label="Fundar um clube"
              icon="group-add"
              variant="secondary"
              fullWidth
              onPress={create}
            />
          </>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -theme.sizes.gutter }}
              contentContainerStyle={{
                gap: theme.spacing.sm,
                paddingHorizontal: theme.sizes.gutter,
                paddingBottom: 4,
              }}
            >
              {mine.map((club) => (
                <ClubChip key={club.id} club={club} onPress={() => openClub(club.id)} />
              ))}
            </ScrollView>
            <BuboTip
              state="reviewDue"
              title="Radar dos clubes"
              titleIcon="auto-awesome"
              trailing={
                feed.data.newLast24h > 0 ? (
                  <Pill tone="success" label={`${feed.data.newLast24h} novos`} />
                ) : undefined
              }
            >
              {feed.data.newLast24h > 0
                ? `${feed.data.newLast24h === 1 ? '1 debate ou enquete novo' : `${feed.data.newLast24h} debates e enquetes novos`} nas últimas 24 horas nos seus clubes. O que passa da sua página continua coberto.`
                : 'Nada novo nas últimas 24 horas. Que tal abrir o próximo debate do seu clube?'}
            </BuboTip>
            {feed.data.items.length === 0 ? (
              <EmptyState
                compact
                mascot="emptyCommunity"
                title="Seus clubes estão quietos"
                description="Abra um debate ou uma enquete: a conversa começa com uma pergunta."
              />
            ) : (
              feed.data.items.map((item) =>
                item.type === 'topic' ? (
                  item.post.locked && item.post.kind === 'discussion' ? (
                    <ProtectedCard
                      key={item.post.id}
                      page={item.post.spoilerPage}
                      readerPage={item.club.readerPage}
                      bookTitle={item.club.bookTitle}
                      onContinue={() => openClub(item.club.id)}
                    />
                  ) : (
                    <TopicCard
                      key={item.post.id}
                      post={item.post}
                      readerPage={item.club.readerPage}
                      club={item.club}
                      onOpen={() =>
                        router.push({
                          pathname: '/debates/[clubId]/[postId]',
                          params: { clubId: item.club.id, postId: item.post.id },
                        })
                      }
                      onReveal={() =>
                        router.push({
                          pathname: '/debates/[clubId]/[postId]',
                          params: { clubId: item.club.id, postId: item.post.id, reveal: '1' },
                        })
                      }
                      onReact={(kind, active) =>
                        react.mutate({ targetType: 'post', targetId: item.post.id, kind, active })
                      }
                    />
                  )
                ) : (
                  <PollCard
                    key={item.poll.id}
                    poll={item.poll}
                    readerPage={item.club.readerPage}
                    clubName={item.club.name}
                    onOpen={() =>
                      router.push({
                        pathname: '/enquetes/[clubId]/[pollId]',
                        params: { clubId: item.club.id, pollId: item.poll.id },
                      })
                    }
                    onReveal={() =>
                      router.push({
                        pathname: '/enquetes/[clubId]/[pollId]',
                        params: { clubId: item.club.id, pollId: item.poll.id, reveal: '1' },
                      })
                    }
                  />
                ),
              )
            )}
          </>
        )
      ) : null}

      {segment === 'mine' ? (
        clubs.isPending ? (
          loading
        ) : clubs.isError ? (
          <InlineMessage tone="error" message="Não foi possível carregar seus clubes." />
        ) : mine.length === 0 ? (
          <EmptyState
            mascot="emptyCommunity"
            title="Você ainda não está em nenhum clube"
            description="Descubra um clube do livro que você está lendo ou funde o seu."
            action={
              <Button
                label="Descobrir clubes"
                icon="explore"
                onPress={() => setSegment('discover')}
              />
            }
          />
        ) : (
          mine.map((club) => (
            <ClubExploreCard key={club.id} club={club} onOpen={() => openClub(club.id)} />
          ))
        )
      ) : null}

      {segment === 'discover' ? (
        <>
          <TextField
            label="Buscar clubes"
            hideLabel
            icon="search"
            placeholder="Buscar por clube ou livro"
            value={text}
            onChangeText={setText}
            returnKeyType="search"
            autoCorrect={false}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityRole="tablist"
            style={{ marginHorizontal: -theme.sizes.gutter }}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.sizes.gutter }}
          >
            {FILTERS.map((option) => (
              <TabChip
                key={option.id}
                label={option.label}
                icon={option.icon}
                selected={filter === option.id}
                onPress={() => setFilter(option.id)}
              />
            ))}
          </ScrollView>
          {affinity.length > 0 ? (
            <BuboTip state="recallPrompt" title="Afinidade do Bubo" titleIcon="auto-awesome">
              {affinity.length === 1
                ? `1 clube lê um livro que já está na sua estante. Os debates se ajustam à sua página.`
                : `${affinity.length} clubes leem livros que já estão na sua estante. Os debates se ajustam à sua página.`}
            </BuboTip>
          ) : null}
          {clubs.isPending ? (
            loading
          ) : clubs.isError ? (
            <InlineMessage tone="error" message="Não foi possível carregar os clubes agora." />
          ) : (
            <>
              <Text variant="label">
                {q ? 'Resultados' : 'Clubes recomendados'}{' '}
                <Text variant="label" color="accentText">
                  {`(${discover.length} ${discover.length === 1 ? 'encontrado' : 'encontrados'})`}
                </Text>
              </Text>
              {discover.map((club) => (
                <ClubExploreCard
                  key={club.id}
                  club={club}
                  highlight={club.onMyShelf ? 'Na sua estante' : undefined}
                  joining={joiningId === club.id}
                  onOpen={() => openClub(club.id)}
                  onJoin={() => joinFromList(club)}
                />
              ))}
            </>
          )}

          <Raised
            faceColor={theme.colors.surface}
            borderColor={theme.colors.borderSoft}
            rimColor={theme.colors.cardShadow}
            radius={20}
            depth={3}
            faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
          >
            <Text variant="label">Recebeu um convite?</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Código do convite"
                  hideLabel
                  icon="vpn-key"
                  placeholder="ABCD-2345"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={code}
                  onChangeText={setCode}
                  error={codeError}
                />
              </View>
              <Button label="Abrir" size="md" compact onPress={openInvite} />
            </View>
          </Raised>

          <View
            style={{
              alignItems: 'center',
              gap: theme.spacing.sm,
              padding: theme.spacing.xl,
              borderRadius: 22,
              borderWidth: theme.sizes.borderWidth,
              borderStyle: 'dashed',
              borderColor: theme.colors.purpleLight,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Icon name="add" size={22} color="accentText" />
            </View>
            <Text variant="bodyStrong" align="center">
              Não encontrou o que queria debater?
            </Text>
            <Text variant="bodySm" color="textMuted" align="center">
              Crie seu próprio clube, defina o ritmo de páginas e seja o Guardião Fundador.
            </Text>
            <Button
              label="Fundar novo clube"
              variant="secondary"
              size="md"
              fullWidth
              onPress={create}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}
