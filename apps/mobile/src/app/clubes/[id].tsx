import { readingProgress } from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, View } from 'react-native';

import {
  BookCover,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  HeaderButton,
  Icon,
  InlineMessage,
  LinkButton,
  ProgressBar,
  SectionHeader,
  Text,
} from '../../design-system';
import { ClubBadge } from '../../features/community/ClubBadge';
import { membersLabel, topicsLabel } from '../../features/community/meta';
import { PostCard } from '../../features/community/PostCard';
import {
  useClub,
  useClubPosts,
  useDeleteClub,
  useJoinClub,
  useLeaveClub,
} from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/**
 * Club profile + debates (Stitch `bubo_perfil_do_clube_de_leitura_mobile_1` and
 * `bubo_clubes_anti_spoiler_mobile`). Every number is real; locked topics carry no text.
 */
export default function ClubScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = typeof id === 'string' ? id : '';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const club = useClub(userId || undefined, clubId);
  const isMember = Boolean(club.data?.membership);
  const posts = useClubPosts(userId || undefined, clubId, isMember);
  const join = useJoinClub(userId, clubId);
  const leave = useLeaveClub(userId, clubId);
  const remove = useDeleteClub(userId, clubId);

  if (club.isPending) {
    return (
      <FormScreen title="Clube de leitura">
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando clube" />
      </FormScreen>
    );
  }
  if (club.isError) {
    return (
      <FormScreen title="Clube de leitura">
        <EmptyState
          mascot="notFound"
          title="Clube não encontrado"
          description="Ele pode ter sido excluído pelo criador."
        />
      </FormScreen>
    );
  }

  const data = club.data;
  const isOwner = data.membership === 'owner';
  const readerPage = data.readerPage ?? 0;
  const progress = readingProgress(readerPage, data.book.totalPages ?? 0);
  const openTopic = (postId: string, reveal = false) =>
    router.push({
      pathname: '/debates/[clubId]/[postId]',
      params: reveal ? { clubId, postId, reveal: '1' } : { clubId, postId },
    });
  const guidelines = () => router.push({ pathname: '/diretrizes/[clubId]', params: { clubId } });

  const confirmLeave = () =>
    Alert.alert('Sair do clube?', 'Seus debates continuam lá. Você pode voltar quando quiser.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () =>
          leave.mutate(undefined, {
            onSuccess: () => haptics.success(),
            onError: () => haptics.error(),
          }),
      },
    ]);
  const confirmDelete = () =>
    Alert.alert('Excluir o clube?', 'Todos os debates e respostas serão apagados para sempre.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: () => {
              haptics.success();
              router.back();
            },
            onError: () => haptics.error(),
          }),
      },
    ]);
  const menu = () =>
    Alert.alert(data.name, undefined, [
      { text: 'Diretrizes do clube', onPress: guidelines },
      isOwner
        ? { text: 'Excluir clube', style: 'destructive', onPress: confirmDelete }
        : { text: 'Sair do clube', style: 'destructive', onPress: confirmLeave },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  return (
    <FormScreen
      title={data.name}
      eyebrow="Clube de leitura"
      headerRight={
        isMember ? <HeaderButton icon="more-vert" label="Opções do clube" onPress={menu} /> : null
      }
      footer={
        isMember ? (
          <Button
            label="Novo debate"
            icon="add-comment"
            fullWidth
            onPress={() => router.push({ pathname: '/novo-debate/[clubId]', params: { clubId } })}
          />
        ) : (
          <>
            {join.isError ? (
              <InlineMessage tone="error" message="Não foi possível entrar agora." />
            ) : null}
            <Button
              label="Entrar e aceitar as diretrizes"
              icon="group-add"
              fullWidth
              loading={join.isPending}
              onPress={() =>
                join.mutate(undefined, {
                  onSuccess: () => haptics.success(),
                  onError: () => haptics.error(),
                })
              }
            />
          </>
        )
      }
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <ClubBadge icon={data.icon} size={64} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="heading" accessibilityRole="header" numberOfLines={3}>
              {data.name}
            </Text>
            {isOwner ? <Chip label="Você criou" tone="primary" icon="star-outline" /> : null}
          </View>
        </View>
        {data.description ? <Text variant="body">{data.description}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip label={membersLabel(data.memberCount)} tone="neutral" icon="group" />
          <Chip label={topicsLabel(data.topicCount)} tone="neutral" icon="forum" />
          {data.weeklyGoalPages ? (
            <Chip label={`Meta: ${data.weeklyGoalPages} págs./semana`} tone="gold" icon="flag" />
          ) : null}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Obra do clube" icon="menu-book" />
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <BookCover
            title={data.book.title}
            author={data.book.author}
            coverUrls={data.book.coverUrls}
            width={72}
          />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="titleSm" numberOfLines={3}>
              {data.book.title}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {[data.book.author, data.book.totalPages ? `${data.book.totalPages} págs.` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        {isMember && progress.totalPages > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label" color="accentText">
                Você: pág. {readerPage}
              </Text>
              <Text variant="bodySm" color="textMuted">
                {progress.percent}%
              </Text>
            </View>
            <ProgressBar
              percent={progress.percent}
              accessibilityLabel={`Seu progresso no livro do clube: ${progress.percent}%`}
            />
          </View>
        ) : null}
      </Card>

      {isMember ? (
        <View
          accessible
          accessibilityLabel={`Blindagem anti-spoiler ativa. Você está na página ${readerPage}. Debates de páginas à frente ficam ocultos.`}
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
          <Icon name="shield" size={32} color="accentText" />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="bodyStrong" color="accentText">
              Blindagem anti-spoiler ativa
            </Text>
            <Text variant="bodySm">
              Você está na pág. {readerPage}. Debates de páginas à frente ficam ocultos. Atualize
              seu progresso na Estante para liberar.
            </Text>
          </View>
        </View>
      ) : (
        <Card tone="muted">
          <SectionHeader title="Antes de entrar" icon="shield" />
          <Text variant="bodySm" color="textMuted">
            Ao entrar, o livro vai para a sua Estante (se ainda não estiver) e você aceita as
            diretrizes: ancorar cada debate na página certa, debater ideias e nunca pessoas.
          </Text>
          <LinkButton label="Ler as diretrizes" align="left" onPress={guidelines} />
        </Card>
      )}

      {isOwner && data.openReports ? (
        <InlineMessage
          tone="info"
          message={
            data.openReports === 1
              ? 'Há 1 denúncia aberta. Os itens denunciados aparecem marcados nos debates.'
              : `Há ${data.openReports} denúncias abertas. Os itens denunciados aparecem marcados nos debates.`
          }
        />
      ) : null}

      {isMember ? (
        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader title="Debates" icon="forum" />
          {posts.isPending ? (
            <ActivityIndicator
              color={theme.colors.primary}
              accessibilityLabel="Carregando debates"
            />
          ) : posts.isError ? (
            <Card>
              <InlineMessage tone="error" message="Não foi possível carregar os debates." />
              <Button
                label="Tentar de novo"
                variant="secondary"
                size="md"
                icon="refresh"
                onPress={() => void posts.refetch()}
              />
            </Card>
          ) : posts.data.posts.length === 0 ? (
            <Card>
              <EmptyState
                compact
                mascot="emptyCommunity"
                title="Nenhum debate ainda"
                description="Abra o primeiro: escolha uma ideia do livro e diga de que página ela é."
              />
            </Card>
          ) : (
            posts.data.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                readerPage={posts.data.readerPage}
                onOpen={() => openTopic(post.id)}
                onPeek={() => openTopic(post.id, true)}
              />
            ))
          )}
        </View>
      ) : null}
    </FormScreen>
  );
}
