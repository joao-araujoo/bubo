import { ARGUMENT_BODY_MAX, type ClubPoll, type PollArgument } from '@bubo/contracts';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, TextInput, View } from 'react-native';

import {
  Avatar,
  BookCover,
  BuboTip,
  Button,
  EmptyState,
  FormScreen,
  HeaderButton,
  Icon,
  InlineMessage,
  Pill,
  ProgressBar,
  Raised,
  SectionTitle,
  SegmentedTabs,
  Text,
} from '../../../design-system';
import { ActionChip } from '../../../features/community/ActionChip';
import { closesLabel, relativeTime, votesLabel } from '../../../features/community/meta';
import { ReactionBar } from '../../../features/community/ReactionBar';
import { ReportPanel } from '../../../features/community/ReportPanel';
import { SpoilerVeil } from '../../../features/community/SpoilerVeil';
import { ApiError } from '../../../lib/api/client';
import {
  useBlockUser,
  useClub,
  useClubPoll,
  useDeleteClubPoll,
  useDeletePollArgument,
  useModerateClubContent,
  useSavePollArgument,
  useSetReaction,
  useVotePoll,
} from '../../../lib/api/queries';
import { useAuthState } from '../../../lib/auth/session';
import { haptics } from '../../../lib/haptics';
import { fontFamily, useTheme } from '../../../theme';

type Tab = 'live' | 'arguments';
type Sort = 'reflexive' | 'recent';
type Target = { targetType: 'poll' | 'argument'; targetId: string };
type Item = Pick<PollArgument, 'id' | 'author' | 'isMine' | 'moderation' | 'openReportCount'>;
type Option = ClubPoll['options'][number];

const reactionTotal = (argument: PollArgument) =>
  argument.reactions.insight + argument.reactions.idea + argument.reactions.counterpoint;

function sortArguments(list: PollArgument[], sort: Sort) {
  return [...list].sort((a, b) =>
    sort === 'reflexive'
      ? reactionTotal(b) - reactionTotal(a) || b.createdAt.localeCompare(a.createdAt)
      : b.createdAt.localeCompare(a.createdAt),
  );
}

/** "Até agora, 68% escolheram “X”." — computed from the real votes, never generated text. */
function synthesis(poll: ClubPoll): string {
  if (poll.locked) return 'Esta enquete fala de uma página à frente da sua. Revele para ver.';
  if (!poll.resultsVisible) {
    return 'Vote para ver como o clube se dividiu. O resultado fica escondido até lá, para ninguém seguir a maioria.';
  }
  if (poll.voterCount === 0) {
    return 'Ninguém votou ainda. Escolha a sua resposta e defenda com um argumento da obra.';
  }
  const top = Math.max(...poll.options.map((option) => option.percent ?? 0));
  const leaders = poll.options.filter((option) => (option.percent ?? 0) === top);
  const when = poll.isOpen ? 'Até agora' : 'No resultado final';
  if (leaders.length > 1) {
    return `${when}, empate entre ${leaders.map((option) => `“${option.label ?? ''}”`).join(' e ')}. Um bom argumento pode mudar votos.`;
  }
  const leader = leaders[0];
  return `${when}, ${top}% escolheram “${leader?.label ?? ''}”.${poll.isOpen && poll.argumentCount === 0 ? ' Ninguém defendeu seu voto ainda: comece o debate!' : ''}`;
}

/** Stitch poll option: numbered or checked circle, label, share and votes, and a result tube. */
function OptionCard({
  option,
  index,
  resultsVisible,
  selected,
  disabled,
  pending,
  multiple,
  onPress,
}: {
  option: Option;
  index: number;
  resultsVisible: boolean;
  selected: boolean;
  disabled: boolean;
  pending: boolean;
  multiple: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const label = option.label ?? `Opção ${index + 1}`;
  const showResult = resultsVisible && option.percent !== null;
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={
        showResult ? `${label}, ${option.percent}%, ${votesLabel(option.votes ?? 0)}` : label
      }
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={selected ? theme.colors.primary : theme.colors.border}
          rimColor={selected ? theme.colors.primaryRim : theme.colors.secondaryRim}
          radius={20}
          depth={4}
          pressed={pressed && !disabled}
          faceStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            {pending ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: theme.radii.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: theme.sizes.borderWidth,
                  borderColor: selected ? theme.colors.primary : theme.colors.purpleLight,
                  backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceMuted,
                }}
              >
                {selected ? (
                  <Icon name="check" size={17} color="onPrimary" />
                ) : (
                  <Text variant="label" color="accentText" style={{ fontSize: 12 }}>
                    {index + 1}
                  </Text>
                )}
              </View>
            )}
            <Text variant="bodyStrong" style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>
              {label}
            </Text>
            {showResult ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  variant="title"
                  color={option.mine ? 'accentText' : 'text'}
                  style={{ fontSize: 20, lineHeight: 24 }}
                >
                  {`${option.percent}%`}
                </Text>
                <Text variant="bodySm" color="textMuted" style={{ fontSize: 11 }}>
                  {votesLabel(option.votes ?? 0)}
                </Text>
              </View>
            ) : null}
          </View>
          {showResult ? (
            <ProgressBar
              percent={option.percent ?? 0}
              size="sm"
              tone={option.mine ? 'primary' : 'muted'}
              accessibilityLabel={`${label}: ${option.percent}%`}
            />
          ) : null}
        </Raised>
      )}
    </Pressable>
  );
}

/**
 * Stitch "Votação e resultados ao vivo": the club and anchor page, the poll with live results
 * (refreshed every 15 s while open), a synthesis computed from the votes, and the members'
 * arguments with reactions. Results stay hidden until the reader votes.
 */
export default function PollScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId: string; pollId: string; reveal?: string }>();
  const clubId = typeof params.clubId === 'string' ? params.clubId : '';
  const pollId = typeof params.pollId === 'string' ? params.pollId : '';
  const reveal = params.reveal === '1';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';

  const club = useClub(userId || undefined, clubId);
  const detail = useClubPoll(userId || undefined, clubId, pollId, reveal);
  const vote = useVotePoll(userId, clubId);
  const saveArgument = useSavePollArgument(userId, clubId, pollId);
  const deleteArgument = useDeletePollArgument(userId, clubId, pollId);
  const deletePoll = useDeleteClubPoll(userId, clubId);
  const moderate = useModerateClubContent(userId, clubId);
  const block = useBlockUser(userId);
  const react = useSetReaction(userId);

  const [tab, setTab] = useState<Tab>('live');
  const [sort, setSort] = useState<Sort>('reflexive');
  const [changing, setChanging] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [pendingOption, setPendingOption] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Target | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const isOpen = detail.data?.poll.isOpen ?? false;
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const eyebrow = club.data ? club.data.name : 'Clube de leitura';
  const header = { title: 'Enquete & Resultados', eyebrow, align: 'left' } as const;

  if (detail.isPending) {
    return (
      <FormScreen {...header}>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando enquete" />
      </FormScreen>
    );
  }
  if (detail.isError) {
    const gone = detail.error instanceof ApiError && detail.error.code === 'NOT_FOUND';
    return (
      <FormScreen {...header}>
        <EmptyState
          mascot={gone ? 'notFound' : 'offline'}
          title={gone ? 'Enquete indisponível' : 'Não foi possível carregar'}
          description={
            gone
              ? 'Ela foi apagada, removida pela moderação, denunciada por você ou é de alguém que você bloqueou.'
              : 'Verifique sua conexão e tente de novo.'
          }
          action={
            gone ? undefined : (
              <Button label="Tentar de novo" icon="refresh" onPress={() => void detail.refetch()} />
            )
          }
        />
      </FormScreen>
    );
  }

  const { poll, readerPage } = detail.data;
  const args = detail.data.arguments;
  const isOwner = club.data?.membership === 'owner';
  const voted = poll.options.some((option) => option.mine);
  const canVote = poll.isOpen && !poll.locked && (!voted || changing);
  const mineIds = poll.options.filter((option) => option.mine).map((option) => option.id);
  const selection = picked ?? mineIds;
  const myArgument = args.find((argument) => argument.isMine);
  const draftText = draft ?? myArgument?.body ?? '';
  const peek = () => router.setParams({ reveal: '1' });
  const secondsAgo = Math.max(0, Math.round((now - detail.dataUpdatedAt) / 1000));
  const inviteCode = club.data?.inviteCode ?? null;

  function submitVote(optionIds: string[]) {
    setPendingOption(optionIds.length === 1 ? (optionIds[0] ?? null) : null);
    vote.mutate(
      { pollId: poll.id, optionIds },
      {
        onSuccess: () => {
          haptics.success();
          setChanging(false);
          setPicked(null);
        },
        onError: () => haptics.error(),
        onSettled: () => setPendingOption(null),
      },
    );
  }

  function pressOption(optionId: string) {
    if (!poll.multiple) {
      submitVote([optionId]);
      return;
    }
    setPicked(
      selection.includes(optionId)
        ? selection.filter((id) => id !== optionId)
        : [...selection, optionId],
    );
  }

  async function sendArgument() {
    const text = draftText.trim();
    if (!text) {
      setComposerError('Escreva por que você votou assim.');
      return;
    }
    setComposerError(null);
    try {
      await saveArgument.mutateAsync(text);
      haptics.success();
      setDraft(null);
      setNotice(myArgument ? 'Argumento atualizado.' : 'Argumento publicado.');
    } catch (e) {
      haptics.error();
      setComposerError(
        e instanceof ApiError && e.code === 'FORBIDDEN'
          ? 'Seu argumento foi removido pela moderação e não pode ser reescrito.'
          : e instanceof ApiError && e.code === 'RATE_LIMITED'
            ? 'Muitas mensagens seguidas. Espere um minuto.'
            : e instanceof ApiError && e.code === 'VALIDATION_FAILED'
              ? 'Vote antes de argumentar e confira o texto.'
              : 'Não foi possível publicar agora.',
      );
    }
  }

  async function sharePoll() {
    if (!inviteCode || !club.data) return;
    const link = Linking.createURL(`convite/${inviteCode}`);
    try {
      await Share.share({
        message: `Tem enquete aberta no clube "${club.data.name}" no Bubo, sem spoilers. Entre pelo convite: ${link}`,
      });
    } catch {
      haptics.error();
    }
  }

  const confirmDelete = (target: Target) =>
    Alert.alert(
      target.targetType === 'poll' ? 'Apagar esta enquete?' : 'Apagar seu argumento?',
      target.targetType === 'poll'
        ? 'Os votos e argumentos somem para sempre.'
        : 'Seu voto continua valendo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => {
            const options = {
              onSuccess: () => {
                haptics.success();
                if (target.targetType === 'poll') router.back();
                else {
                  setDraft(null);
                  setNotice('Argumento apagado.');
                }
              },
              onError: () => haptics.error(),
            };
            if (target.targetType === 'poll') deletePoll.mutate(poll.id, options);
            else deleteArgument.mutate(undefined, options);
          },
        },
      ],
    );

  const confirmBlock = (author: Item['author']) =>
    Alert.alert(
      `Bloquear ${author.name}?`,
      'Os debates, enquetes e argumentos dessa pessoa somem para você em todos os clubes. Você pode desbloquear em Você → Leitores bloqueados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () =>
            block.mutate(author.id, {
              onSuccess: () => {
                haptics.success();
                if (author.id === poll.author.id) router.back();
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
          if (action === 'remove' && target.targetType === 'poll') router.back();
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
            if (targetType === 'poll') router.back();
            else setNotice('Denúncia enviada. Obrigado por cuidar do clube.');
          }}
        />
      );
    }
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {item.isMine ? (
          <ActionChip
            label={targetType === 'poll' ? 'Apagar enquete' : 'Apagar'}
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

  const argumentCard = (argument: PollArgument) => (
    <Raised
      key={argument.id}
      faceColor={theme.colors.surface}
      borderColor={theme.colors.borderSoft}
      rimColor={theme.colors.cardShadow}
      radius={22}
      depth={theme.sizes.cardRim}
      faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Avatar name={argument.author.name} size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
              {argument.isMine ? 'Você' : argument.author.name}
            </Text>
            <Pill label={`Nív. ${argument.author.level}`} />
          </View>
          <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }} numberOfLines={2}>
            {argument.votedFor.length > 0 ? 'Votou em: ' : 'Voto alterado'}
            {argument.votedFor.length > 0 ? (
              <Text
                variant="bodySm"
                color="textMuted"
                style={{ fontSize: 12, fontFamily: fontFamily.bold }}
              >
                {argument.votedFor.join(', ')}
              </Text>
            ) : null}
          </Text>
        </View>
        <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
          {relativeTime(argument.createdAt)}
        </Text>
      </View>
      {moderationNote(argument)}
      {argument.body === null ? (
        <SpoilerVeil spoilerPage={poll.spoilerPage} readerPage={readerPage} onReveal={peek} />
      ) : (
        <View
          style={{
            paddingLeft: theme.spacing.md,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.purpleLight,
          }}
        >
          <Text variant="body" style={{ lineHeight: 23 }}>
            {`“${argument.body}”`}
          </Text>
        </View>
      )}
      {argument.body === null ? null : (
        <View
          style={{
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.colors.borderSoft,
          }}
        >
          <ReactionBar
            reactions={argument.reactions}
            mine={argument.myReactions}
            showLabels={reactionTotal(argument) === 0}
            disabled={argument.isMine}
            onToggle={(kind, active) =>
              react.mutate({ targetType: 'argument', targetId: argument.id, kind, active })
            }
          />
        </View>
      )}
      {argument.isMine ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <ActionChip label="Editar" icon="edit" onPress={() => setDraft(argument.body ?? '')} />
          <ActionChip
            label="Apagar"
            icon="delete-outline"
            tone="danger"
            onPress={() => confirmDelete({ targetType: 'argument', targetId: argument.id })}
          />
        </View>
      ) : (
        actions(argument, 'argument')
      )}
    </Raised>
  );

  const sorted = sortArguments(args, sort);
  const shown = tab === 'live' ? sorted.slice(0, 3) : sorted;
  const sortToggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        sort === 'reflexive' ? 'Ordenar: mais reflexivos' : 'Ordenar: mais recentes'
      }
      accessibilityHint="Toque para trocar a ordem"
      hitSlop={10}
      onPress={() => {
        haptics.selection();
        setSort(sort === 'reflexive' ? 'recent' : 'reflexive');
      }}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}
    >
      <Text variant="label" color="accentText" style={{ fontSize: 13 }}>
        {sort === 'reflexive' ? 'Mais reflexivos' : 'Mais recentes'}
      </Text>
      <Icon name="expand-more" size={18} color="accentText" />
    </Pressable>
  );

  const footer = poll.locked ? undefined : (
    <>
      {composerError ? <InlineMessage tone="error" message={composerError} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        <Icon name="edit-note" size={18} color="accentText" />
        <Text variant="caption" color="accentText" style={{ flex: 1 }}>
          {!voted
            ? 'Vote para defender sua escolha'
            : myArgument
              ? 'Editar seu argumento'
              : 'Defender seu voto com argumento'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
        <TextInput
          accessibilityLabel="Seu argumento"
          editable={voted}
          placeholder={voted ? 'Explique por que você votou assim…' : 'Escolha uma opção primeiro'}
          placeholderTextColor={theme.colors.textMuted}
          value={draftText}
          onChangeText={setDraft}
          maxLength={ARGUMENT_BODY_MAX}
          multiline
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radii.pill,
            borderWidth: theme.sizes.borderWidth,
            borderColor: theme.colors.purpleLight,
            backgroundColor: voted ? theme.colors.surface : theme.colors.surfaceMuted,
            color: theme.colors.text,
            fontFamily: fontFamily.medium,
            fontSize: 15,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={myArgument ? 'Salvar argumento' : 'Publicar argumento'}
          accessibilityState={{ busy: saveArgument.isPending, disabled: !voted }}
          disabled={!voted || saveArgument.isPending}
          onPress={() => void sendArgument()}
        >
          {({ pressed }) => (
            <Raised
              faceColor={voted ? theme.colors.primary : theme.colors.purpleLight}
              borderColor={theme.colors.primaryRim}
              rimColor={theme.colors.primaryRim}
              radius={theme.radii.pill}
              depth={4}
              pressed={pressed}
              faceStyle={{ width: 48, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              {saveArgument.isPending ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <Icon name="send" size={20} color="onPrimary" />
              )}
            </Raised>
          )}
        </Pressable>
      </View>
    </>
  );

  return (
    <FormScreen
      {...header}
      eyebrowDot={poll.isOpen}
      headerRight={
        inviteCode ? (
          <HeaderButton
            icon="share"
            label="Chamar amigos para o clube"
            shape="square"
            iconColor="accentText"
            onPress={() => void sharePoll()}
          />
        ) : null
      }
      footer={footer}
    >
      <SegmentedTabs
        accessibilityLabel="Seções da enquete"
        value={tab}
        onChange={setTab}
        options={[
          {
            id: 'live',
            label: poll.isOpen
              ? `Ao vivo (${votesLabel(poll.voterCount)})`
              : `Resultado (${votesLabel(poll.voterCount)})`,
          },
          {
            id: 'arguments',
            label: poll.argumentCount === 1 ? '1 Argumento' : `${poll.argumentCount} Argumentos`,
          },
        ]}
      />

      {notice ? <InlineMessage tone="success" message={notice} /> : null}

      <Raised
        faceColor={theme.colors.surface}
        borderColor={theme.colors.borderSoft}
        rimColor={theme.colors.cardShadow}
        radius={20}
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
            width={40}
          />
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={1}>
            {club.data
              ? [club.data.name, club.data.book.author].filter(Boolean).join(' • ')
              : 'Clube de leitura'}
          </Text>
          <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }} numberOfLines={1}>
            {`${poll.spoilerPage > 0 ? `Pág. ${poll.spoilerPage} ancorada` : 'Sem página'} • ${closesLabel(poll.closesAt, poll.isOpen)}`}
          </Text>
        </View>
        {poll.spoilerPage <= readerPage ? (
          <Pill icon="shield" label="Blindada" />
        ) : poll.locked ? (
          <Pill tone="error" icon="visibility-off" label="Coberta" />
        ) : (
          <Pill tone="warning" icon="visibility" label="Revelada" />
        )}
      </Raised>

      {tab === 'live' ? (
        <>
          {moderationNote(poll)}
          <Raised
            faceColor={theme.colors.surface}
            borderColor={theme.colors.purpleLight}
            rimColor={theme.colors.primarySoft}
            radius={24}
            depth={theme.sizes.cardRim}
            faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Pill
                  caps
                  icon="how-to-vote"
                  label={poll.isOpen ? 'Enquete do clube' : 'Enquete encerrada'}
                />
              </View>
              {voted ? <Pill tone="success" icon="check-circle-outline" label="Seu voto" /> : null}
            </View>

            {poll.locked ? (
              <SpoilerVeil spoilerPage={poll.spoilerPage} readerPage={readerPage} onReveal={peek} />
            ) : (
              <>
                <View style={{ gap: theme.spacing.xs }}>
                  <Text
                    variant="title"
                    accessibilityRole="header"
                    style={{ fontSize: 19, lineHeight: 26 }}
                  >
                    {poll.question}
                  </Text>
                  <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                    {[
                      `Criada por ${poll.isMine ? 'você' : poll.author.name}`,
                      poll.voterCount === 1
                        ? '1 membro votou'
                        : `${poll.voterCount} membros votaram`,
                      poll.multiple ? 'várias respostas' : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                </View>
                <View
                  accessibilityRole={poll.multiple ? undefined : 'radiogroup'}
                  style={{ gap: theme.spacing.md }}
                >
                  {poll.options.map((option, index) => (
                    <OptionCard
                      key={option.id}
                      option={option}
                      index={index}
                      multiple={poll.multiple}
                      resultsVisible={poll.resultsVisible}
                      selected={
                        canVote && poll.multiple ? selection.includes(option.id) : option.mine
                      }
                      disabled={!canVote || vote.isPending}
                      pending={pendingOption === option.id}
                      onPress={() => pressOption(option.id)}
                    />
                  ))}
                </View>
                {canVote && poll.multiple ? (
                  <Button
                    label={voted ? 'Salvar novo voto' : 'Confirmar voto'}
                    icon="how-to-vote"
                    disabled={selection.length === 0}
                    loading={vote.isPending}
                    onPress={() => submitVote(selection)}
                  />
                ) : null}
                {vote.isError ? (
                  <InlineMessage
                    tone="error"
                    message={
                      vote.error instanceof ApiError && vote.error.code === 'CONFLICT'
                        ? 'A votação já encerrou.'
                        : 'Não foi possível votar agora.'
                    }
                  />
                ) : null}
              </>
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                minHeight: 36,
              }}
            >
              {voted && poll.isOpen && !poll.locked ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={changing ? 'Cancelar troca de voto' : 'Alterar meu voto'}
                  hitSlop={10}
                  onPress={() => {
                    haptics.selection();
                    setChanging(!changing);
                    setPicked(null);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}
                >
                  <Icon name={changing ? 'close' : 'swap-horiz'} size={16} color="textMuted" />
                  <Text
                    variant="label"
                    color="textMuted"
                    style={{ fontSize: 13, textDecorationLine: 'underline' }}
                  >
                    {changing ? 'Manter meu voto' : 'Alterar meu voto'}
                  </Text>
                </Pressable>
              ) : (
                <Text variant="bodySm" color="textMuted" style={{ flex: 1, fontSize: 12 }}>
                  {poll.resultsVisible || poll.locked
                    ? ''
                    : 'Os resultados aparecem depois do seu voto.'}
                </Text>
              )}
              {poll.isOpen ? (
                <>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: theme.radii.pill,
                      backgroundColor: theme.colors.success,
                    }}
                  />
                  <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                    {secondsAgo < 5 ? 'Atualizado agora' : `Atualizado há ${secondsAgo}s`}
                  </Text>
                </>
              ) : (
                <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                  Votação encerrada
                </Text>
              )}
            </View>
          </Raised>
          {actions(poll, 'poll')}

          <BuboTip pose="idea" title="Síntese do Bubo" titleIcon="psychology" tone="soft">
            {synthesis(poll)}
          </BuboTip>
        </>
      ) : null}

      <SectionTitle
        icon="rate-review"
        title={tab === 'live' ? 'Argumentos em destaque' : 'Todos os argumentos'}
        trailing={args.length > 1 ? sortToggle : undefined}
      />
      {args.length === 0 ? (
        <EmptyState
          compact
          mascot="recallPrompt"
          title="Nenhum argumento ainda"
          description={
            voted
              ? 'Conte por que você votou assim. Argumentos da obra enriquecem o debate.'
              : 'Vote e defenda sua escolha com um argumento da obra.'
          }
        />
      ) : (
        shown.map(argumentCard)
      )}
      {tab === 'live' && args.length > shown.length ? (
        <Button
          label={`Ver todos os ${args.length} argumentos`}
          icon="forum"
          variant="secondary"
          onPress={() => setTab('arguments')}
        />
      ) : null}
    </FormScreen>
  );
}
