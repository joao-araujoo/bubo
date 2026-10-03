import { type LeagueResponse } from '@bubo/contracts';
import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  FormScreen,
  Icon,
  InlineMessage,
  Text,
} from '../design-system';
import { useLeague } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { useTheme } from '../theme';

function movement(league: LeagueResponse) {
  const previous = league.me.previousRank;
  if (previous === null) return { label: 'A semana está começando', up: false };
  const delta = previous - league.me.rank;
  if (delta > 0)
    return { label: `+${delta} ${delta === 1 ? 'posição' : 'posições'} hoje`, up: true };
  if (delta < 0)
    return {
      label: `${-delta} ${delta === -1 ? 'posição' : 'posições'} abaixo de ontem`,
      up: false,
    };
  return { label: 'Mesma posição', up: false };
}

/**
 * Weekly friends league (ADR-029): the reader and accepted friends who share their activity,
 * ranked by the real XP of this Monday→Sunday week. Opened from the "Liga semanal" widget.
 */
export default function LeagueScreen() {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const league = useLeague(userId);
  const data = league.data;
  const friends = data ? data.entries.length > 1 : false;
  const days = data ? (data.daysLeft === 1 ? 'Último dia' : `${data.daysLeft} dias restantes`) : '';

  return (
    <FormScreen align="left" eyebrow="Amigos" eyebrowDot title="Liga semanal">
      {league.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando a liga" />
      ) : league.isError || !data ? (
        <>
          <InlineMessage
            tone="error"
            message="Não foi possível carregar a liga agora. Verifique a conexão e tente de novo."
          />
          <Button label="Tentar de novo" icon="refresh" onPress={() => void league.refetch()} />
        </>
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: theme.radii.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primarySoft,
                }}
              >
                <Icon name="emoji-events" size={30} color="accentText" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" color="accentText">
                  {friends ? `#${data.me.rank} entre amigos` : `${data.me.weeklyXp} XP`}
                </Text>
                <Text variant="bodySm" color="textMuted">
                  {friends
                    ? `${data.me.weeklyXp} XP nesta semana · ${days}`
                    : `nesta semana · ${days}`}
                </Text>
              </View>
            </View>
            {friends ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                <Icon
                  name={movement(data).up ? 'arrow-drop-up' : 'drag-handle'}
                  size={22}
                  color={movement(data).up ? 'successText' : 'textMuted'}
                />
                <Text variant="label" color={movement(data).up ? 'successText' : 'textMuted'}>
                  {movement(data).label}
                </Text>
              </View>
            ) : null}
          </Card>

          {friends ? (
            <Card>
              {data.entries.map((entry) => (
                <View
                  key={`${entry.rank}-${entry.name}`}
                  accessible
                  accessibilityLabel={`${entry.rank}º lugar: ${entry.me ? 'você' : entry.name}, ${entry.weeklyXp} XP`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    minHeight: 56,
                    paddingHorizontal: theme.spacing.sm,
                    borderRadius: theme.radii.md,
                    backgroundColor: entry.me ? theme.colors.primarySoft : theme.colors.transparent,
                  }}
                >
                  <Text variant="label" color="textMuted" style={{ width: 28 }}>
                    {`#${entry.rank}`}
                  </Text>
                  <Avatar name={entry.name} size={40} />
                  <Text
                    variant="bodyStrong"
                    numberOfLines={1}
                    style={{ flex: 1 }}
                    color={entry.me ? 'accentText' : 'text'}
                  >
                    {entry.me ? 'Você' : entry.name}
                  </Text>
                  <Text variant="label" color={entry.me ? 'accentText' : 'textMuted'}>
                    {`${entry.weeklyXp} XP`}
                  </Text>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState
              mascot="emptyCommunity"
              title="Sua liga começa com amigos"
              description="Faça amizade com leitores dos seus clubes. Quem compartilha as leituras entra na sua liga da semana."
              action={
                <Button
                  label="Ver amigos"
                  icon="group"
                  variant="secondary"
                  onPress={() => router.push('/amigos')}
                />
              }
            />
          )}

          {!data.sharing ? (
            <InlineMessage
              tone="info"
              message="Seus amigos não veem você na liga deles enquanto o compartilhamento de leituras estiver desligado (Amigos → Privacidade)."
            />
          ) : null}
          <Text variant="bodySm" color="textMuted">
            O XP vem só de sessões de leitura e revisões reais desta semana (segunda a domingo). De
            cada amigo, conta apenas a atividade feita depois que ele passou a compartilhar.
          </Text>
        </>
      )}
    </FormScreen>
  );
}
