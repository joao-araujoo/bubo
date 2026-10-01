import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';

import {
  Button,
  EmptyState,
  FormScreen,
  HeaderButton,
  InlineMessage,
  TabChip,
} from '../../design-system';
import { BookStrip } from '../../features/community/BookStrip';
import { ClubProfile } from '../../features/community/club/ClubProfile';
import { ForumTab } from '../../features/community/club/ForumTab';
import { BookReviewsTab } from '../../features/community/club/BookReviewsTab';
import { CyclesTab } from '../../features/community/club/CyclesTab';
import { GuidelinesTab } from '../../features/community/club/GuidelinesTab';
import { MembersTab } from '../../features/community/club/MembersTab';
import { PollsTab } from '../../features/community/club/PollsTab';
import { useClub, useDeleteClub, useJoinClub, useLeaveClub } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type Tab = 'forum' | 'resenhas' | 'ciclos' | 'enquetes' | 'membros' | 'diretrizes';
const TABS: Tab[] = ['forum', 'resenhas', 'ciclos', 'enquetes', 'membros', 'diretrizes'];

/**
 * A club (Stitch "Clube de leitura: fórum & enquetes", "Membros & estatísticas", "Diretrizes &
 * blindagem", "Perfil do clube"). Members land on the forum; visitors on the profile.
 */
export default function ClubScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; tab?: string; view?: string }>();
  const clubId = typeof params.id === 'string' ? params.id : '';
  const initialTab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'forum';
  const [tab, setTab] = useState<Tab>(initialTab);
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const club = useClub(userId || undefined, clubId);
  const join = useJoinClub(userId);
  const leave = useLeaveClub(userId, clubId);
  const remove = useDeleteClub(userId, clubId);

  if (club.isPending) {
    return (
      <FormScreen title="Clube de leitura" align="left">
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando clube" />
      </FormScreen>
    );
  }
  if (club.isError) {
    return (
      <FormScreen title="Clube de leitura" align="left">
        <EmptyState
          mascot="notFound"
          title="Clube não encontrado"
          description="Ele pode ter sido excluído, ou é privado e só abre com um convite."
        />
      </FormScreen>
    );
  }

  const data = club.data;
  const member = data.membership !== null;
  const owner = data.membership === 'owner';
  const showProfile = !member || params.view === 'perfil';
  const invite = () => router.push({ pathname: '/convidar/[clubId]', params: { clubId } });
  const joinClub = () =>
    join.mutate(clubId, {
      onSuccess: () => {
        haptics.success();
        router.setParams({ view: undefined });
      },
      onError: () => haptics.error(),
    });

  const confirmLeave = () =>
    Alert.alert('Sair do clube?', 'Seus debates continuam lá. Você pode voltar quando quiser.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () =>
          leave.mutate(undefined, {
            onSuccess: () => {
              haptics.success();
              router.back();
            },
            onError: () => haptics.error(),
          }),
      },
    ]);
  const confirmDelete = () =>
    Alert.alert(
      'Excluir o clube?',
      'Todos os debates, enquetes e respostas serão apagados para sempre.',
      [
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
      ],
    );
  const menu = () =>
    Alert.alert(data.name, undefined, [
      showProfile
        ? { text: 'Voltar ao fórum', onPress: () => router.setParams({ view: undefined }) }
        : { text: 'Sobre o clube', onPress: () => router.setParams({ view: 'perfil' }) },
      owner
        ? { text: 'Excluir clube', style: 'destructive', onPress: confirmDelete }
        : { text: 'Sair do clube', style: 'destructive', onPress: confirmLeave },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  const headerRight = member ? (
    <>
      <HeaderButton
        icon="person-add"
        label="Convidar membros"
        shape="square"
        iconColor="accentText"
        onPress={invite}
      />
      <HeaderButton icon="more-vert" label="Opções do clube" shape="square" onPress={menu} />
    </>
  ) : null;

  if (showProfile && tab !== 'diretrizes') {
    return (
      <FormScreen
        align="left"
        eyebrow="Clube de leitura"
        eyebrowDot
        title={data.name}
        headerRight={headerRight}
        footer={
          member ? undefined : (
            <>
              {join.isError ? (
                <InlineMessage tone="error" message="Não foi possível entrar agora." />
              ) : null}
              <Button
                label="Entrar e aceitar as diretrizes"
                icon="group-add"
                fullWidth
                loading={join.isPending}
                onPress={joinClub}
              />
            </>
          )
        }
      >
        <ClubProfile
          club={data}
          joining={join.isPending}
          onJoin={joinClub}
          onInvite={invite}
          onGuidelines={() => {
            setTab('diretrizes');
            if (member) router.setParams({ view: undefined });
          }}
        />
      </FormScreen>
    );
  }

  if (!member) {
    return (
      <FormScreen
        align="left"
        eyebrow="Clube de leitura"
        title="Diretrizes & blindagem"
        headerRight={
          <HeaderButton
            icon="info-outline"
            label="Voltar ao perfil do clube"
            shape="square"
            iconColor="accentText"
            onPress={() => setTab('forum')}
          />
        }
        footer={
          <Button
            label="Entrar e aceitar as diretrizes"
            icon="group-add"
            fullWidth
            loading={join.isPending}
            onPress={joinClub}
          />
        }
      >
        <GuidelinesTab club={data} ownerName={data.ownerName} />
      </FormScreen>
    );
  }

  const floating =
    tab === 'forum' ? (
      <Button
        label="Novo tópico"
        icon="add-comment"
        size="md"
        onPress={() => router.push({ pathname: '/novo-debate/[clubId]', params: { clubId } })}
      />
    ) : tab === 'enquetes' ? (
      <Button
        label="Nova enquete"
        icon="how-to-vote"
        size="md"
        onPress={() => router.push({ pathname: '/nova-enquete/[clubId]', params: { clubId } })}
      />
    ) : undefined;

  return (
    <FormScreen
      align="left"
      eyebrow="Clube de leitura"
      eyebrowDot
      title={data.name}
      headerRight={headerRight}
      floating={floating}
    >
      <BookStrip club={data} />
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
          label="Debates & Fórum"
          icon="forum"
          selected={tab === 'forum'}
          onPress={() => setTab('forum')}
        />
        <TabChip
          label="Enquetes"
          icon="how-to-vote"
          count={data.pollCount}
          selected={tab === 'enquetes'}
          onPress={() => setTab('enquetes')}
        />
        <TabChip
          label="Resenhas"
          icon="edit-note"
          selected={tab === 'resenhas'}
          onPress={() => setTab('resenhas')}
        />
        <TabChip
          label="Ciclos"
          icon="history"
          selected={tab === 'ciclos'}
          onPress={() => setTab('ciclos')}
        />
        <TabChip
          label="Membros"
          icon="group"
          count={data.memberCount}
          selected={tab === 'membros'}
          onPress={() => setTab('membros')}
        />
        <TabChip
          label="Diretrizes"
          icon="gavel"
          selected={tab === 'diretrizes'}
          onPress={() => setTab('diretrizes')}
        />
      </ScrollView>
      {data.openReports ? (
        <InlineMessage
          tone="info"
          message={
            data.openReports === 1
              ? 'Há 1 denúncia aberta. O item denunciado aparece marcado.'
              : `Há ${data.openReports} denúncias abertas. Os itens denunciados aparecem marcados.`
          }
        />
      ) : null}
      {tab === 'forum' ? <ForumTab club={data} userId={userId} /> : null}
      {tab === 'resenhas' ? <BookReviewsTab club={data} userId={userId} /> : null}
      {tab === 'ciclos' ? <CyclesTab club={data} userId={userId} /> : null}
      {tab === 'enquetes' ? <PollsTab club={data} userId={userId} /> : null}
      {tab === 'membros' ? <MembersTab club={data} userId={userId} /> : null}
      {tab === 'diretrizes' ? <GuidelinesTab club={data} ownerName={data.ownerName} /> : null}
    </FormScreen>
  );
}
