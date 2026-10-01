import { type ClubDetail, type ClubMember } from '@bubo/contracts';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import {
  Avatar,
  Button,
  BookCover,
  BuboTip,
  Card,
  Icon,
  InlineMessage,
  Pill,
  ProgressBar,
  SectionTitle,
  StatTile,
  TabChip,
  Text,
  TextField,
} from '../../../design-system';
import { useClubMembers, useChangeFriend } from '../../../lib/api/queries';
import { useTheme } from '../../../theme';
import { membersLabel } from '../meta';

type Filter = 'all' | 'owner' | 'range';

function MemberRow({ member }: { member: ClubMember }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${member.isYou ? 'Você' : member.name}${member.role === 'owner' ? ', criador' : ''}. Nível ${member.level}, ${member.levelTitle}. Página ${member.page}${member.percent !== null ? `, ${member.percent}%` : ''}.`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radii.lg,
        borderWidth: theme.sizes.borderWidth,
        borderColor: member.isYou ? theme.colors.primary : theme.colors.borderSoft,
        backgroundColor: member.isYou ? theme.colors.primarySoft : theme.colors.surface,
      }}
    >
      <Avatar name={member.name} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Text
            variant="label"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
            color={member.isYou ? 'accentText' : 'text'}
          >
            {member.isYou ? 'Seu perfil de leitor' : member.name}
          </Text>
          {member.role === 'owner' ? <Pill caps label="Criador" /> : null}
          {member.isYou ? <Pill caps tone="primarySolid" label="Você" /> : null}
        </View>
        <Text variant="bodySm" color="textMuted" numberOfLines={1} style={{ fontSize: 12 }}>
          {`Nível ${member.level} • ${member.levelTitle}`}
        </Text>
        <Text variant="label" color="accentText" style={{ fontSize: 12 }}>
          {member.percent !== null
            ? `Pág. ${member.page} (${member.percent}%)`
            : `Pág. ${member.page}`}
        </Text>
      </View>
    </View>
  );
}

/** Stitch "Membros & estatísticas", with each member's real shelf page and level. */
export function MembersTab({ club, userId }: { club: ClubDetail; userId: string }) {
  const theme = useTheme();
  const members = useClubMembers(userId, club.id, true);
  const friendship = useChangeFriend(userId);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  if (members.isPending) {
    return (
      <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando membros" />
    );
  }
  if (members.isError) {
    return <InlineMessage tone="error" message="Não foi possível carregar os membros agora." />;
  }
  const data = members.data;
  const total = club.book.totalPages;
  const myBucket =
    data.distribution.find(
      (bucket) => data.readerPage >= bucket.from && data.readerPage <= bucket.to,
    ) ?? data.distribution[0];
  const ahead = data.members.filter((m) => !m.isYou && m.page > data.readerPage).length;
  const others = data.members.length - 1;
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visible = data.members.filter((member) => {
    if (filter === 'owner' && member.role !== 'owner') return false;
    if (
      filter === 'range' &&
      myBucket &&
      (member.page < myBucket.from - 1 || member.page > myBucket.to)
    ) {
      return false;
    }
    return term === '' || member.name.toLocaleLowerCase('pt-BR').includes(term);
  });

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name="auto-stories" size={18} color="accentText" />
          <Text variant="caption" color="accentText" style={{ flex: 1 }}>
            Leitura em andamento
          </Text>
          {club.weeklyGoalPages ? (
            <Pill tone="success" label={`Meta ${club.weeklyGoalPages} págs/sem`} />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <BookCover
            title={club.book.title}
            author={club.book.author}
            coverUrls={club.book.coverUrls}
            width={44}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" numberOfLines={2}>
              {club.name}
            </Text>
            <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
              {`${membersLabel(data.stats.memberCount)} • ${club.book.title}`}
            </Text>
          </View>
        </View>
        {data.averagePercent !== null ? (
          <View style={{ gap: theme.spacing.xs }}>
            <ProgressBar
              percent={data.averagePercent}
              size="sm"
              accessibilityLabel={`Média do clube: ${data.averagePercent}%`}
            />
            <Text variant="label" color="accentText" align="right" style={{ fontSize: 12 }}>
              {`${data.averagePercent}% méd.`}
            </Text>
          </View>
        ) : null}
      </Card>

      <BuboTip state="recallPrompt" title="Termômetro do clube" titleIcon="insights" tone="soft">
        {others <= 0
          ? 'Por enquanto só você por aqui. Convide alguém para ler junto!'
          : ahead === 0
            ? `Você é quem está mais adiante no livro. Cuidado com spoilers: marque sempre a página.`
            : `${ahead} de ${others} ${others === 1 ? 'membro está' : 'membros estão'} adiante da sua página (${data.readerPage}). Os debates deles ficam cobertos para você.`}
      </BuboTip>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatTile
          label="Membros"
          value={String(data.stats.memberCount)}
          icon="group"
          footer="Leitores do clube"
        />
        <StatTile
          label="Páginas lidas"
          value={data.stats.pagesRead.toLocaleString('pt-BR')}
          unit="total"
          icon="menu-book"
          tone="blue"
          footer="Somadas no livro do clube"
        />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatTile
          label="Discussões"
          value={data.stats.discussions.toLocaleString('pt-BR')}
          icon="forum"
          tone="orange"
          footer={<Pill tone="warning" label="100% anti-spoiler" />}
        />
        <StatTile
          label="Votos"
          value={data.stats.pollVotes.toLocaleString('pt-BR')}
          unit="em enquetes"
          icon="how-to-vote"
          tone="success"
          valueColor="successText"
          footer="Participação nas enquetes"
        />
      </View>

      {data.distribution.length > 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
            <Icon name="bar-chart" size={20} color="accentText" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Distribuição por página da obra</Text>
              <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                {`Onde os ${data.stats.memberCount} leitores estão agora`}
              </Text>
            </View>
            {total ? <Pill label={`${club.book.title.slice(0, 14)} (${total}p)`} /> : null}
          </View>
          {data.distribution.map((bucket) => {
            const share = data.stats.memberCount
              ? Math.round((bucket.count / data.stats.memberCount) * 100)
              : 0;
            const mine = bucket === myBucket;
            return (
              <View
                key={bucket.from}
                style={{
                  gap: theme.spacing.xs,
                  padding: mine ? theme.spacing.sm : 0,
                  borderRadius: theme.radii.md,
                  borderWidth: mine ? 1 : 0,
                  borderColor: theme.colors.purpleLight,
                  backgroundColor: mine ? theme.colors.surfaceMuted : theme.colors.transparent,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                  {mine ? <Icon name="flag" size={16} color="accentText" /> : null}
                  <Text variant="bodySm" color={mine ? 'accentText' : 'text'} style={{ flex: 1 }}>
                    {mine
                      ? `Págs. ${bucket.from}–${bucket.to} (você: p. ${data.readerPage})`
                      : `Págs. ${bucket.from}–${bucket.to}`}
                  </Text>
                  <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                    {`${bucket.count} ${bucket.count === 1 ? 'membro' : 'membros'} (${share}%)`}
                  </Text>
                </View>
                <ProgressBar
                  percent={share}
                  size="sm"
                  tone={mine ? 'primary' : bucket.to === total ? 'success' : 'muted'}
                  accessibilityLabel={`Páginas ${bucket.from} a ${bucket.to}: ${share}% dos membros`}
                />
              </View>
            );
          })}
        </Card>
      ) : null}

      <SectionTitle
        icon="groups"
        title="Quadro de membros"
        subtitle="Ordenado pela página no livro"
      />
      <TextField
        label="Buscar membro"
        hideLabel
        icon="search"
        placeholder="Buscar membro pelo nome"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -theme.sizes.gutter }}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.sizes.gutter }}
      >
        <TabChip
          label="Todos"
          count={data.members.length}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <TabChip label="Criador" selected={filter === 'owner'} onPress={() => setFilter('owner')} />
        <TabChip
          label="Na sua faixa de páginas"
          selected={filter === 'range'}
          onPress={() => setFilter('range')}
        />
      </ScrollView>
      {visible.length === 0 ? (
        <Text variant="bodySm" color="textMuted">
          Ninguém com esse filtro.
        </Text>
      ) : (
        visible.map((member) => (
          <View key={member.userId} style={{ gap: theme.spacing.xs }}>
            <MemberRow member={member} />
            {!member.isYou ? (
              <Button
                label={`Pedir amizade a ${member.name}`}
                size="md"
                variant="secondary"
                disabled={friendship.isPending}
                onPress={() => friendship.mutate({ otherId: member.userId, action: 'request' })}
              />
            ) : null}
          </View>
        ))
      )}
      {friendship.isSuccess ? (
        <InlineMessage
          tone="success"
          message="Pedido registrado. Acompanhe em Comunidade → Amigos de leitura."
        />
      ) : null}
      {friendship.isError ? (
        <InlineMessage
          tone="error"
          message="Não foi possível enviar. Essa pessoa pode não estar recebendo pedidos."
        />
      ) : null}
      <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
        A página de cada membro vem da estante dele e só aparece para quem está no clube.
      </Text>
    </>
  );
}
