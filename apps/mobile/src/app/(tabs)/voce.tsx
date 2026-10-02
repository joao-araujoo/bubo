import { type AchievementsResponse, type MeResponse } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  ActionRow,
  Button,
  HeaderButton,
  Icon,
  LinkButton,
  Pill,
  ProgressBar,
  Raised,
  Screen,
  SectionTitle,
  Text,
  initialsOf,
} from '../../design-system';
import { CATEGORY_META, achievementIcon } from '../../features/achievements/meta';
import { NotificationBell } from '../../features/notifications/NotificationBell';
import { GENRE_OPTIONS, GOAL_OPTIONS, HABIT_OPTIONS } from '../../features/onboarding/options';
import {
  useAchievements,
  useMemoryStats,
  usePreferences,
  useShelf,
  useStats,
} from '../../lib/api/queries';
import { useAuthState, useSignOut } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

function Surface({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Raised
      faceColor={theme.colors.surface}
      borderColor={theme.colors.borderSoft}
      rimColor={theme.colors.cardShadow}
      radius={24}
      depth={theme.sizes.cardRim}
      faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
    >
      {children}
    </Raised>
  );
}

/** Stitch metric box: big coloured value over a small muted label. */
function Metric({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: 'text' | 'accentText' | 'warningText';
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radii.md,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.borderSoft,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <Text variant="titleSm" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="bodySm" color="textMuted" align="center" style={{ fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

/** Stitch profile hero: squircle initials with a gold star, name, level pill and XP to next. */
function ProfileCard({
  me,
  achievements,
  booksRead,
  remembered,
  streak,
}: {
  me: MeResponse;
  achievements: AchievementsResponse | undefined;
  booksRead: number | null;
  remembered: number | null;
  streak: number | null;
}) {
  const theme = useTheme();
  const level = achievements?.level;
  const span = level && level.nextLevelXp !== null ? level.nextLevelXp - level.levelStartXp : null;
  const percent =
    level && span ? Math.min(100, ((level.xpTotal - level.levelStartXp) / span) * 100) : 100;
  return (
    <Surface>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View>
          <View
            accessible
            accessibilityLabel={`Avatar de ${me.user.name}`}
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 3,
              borderColor: theme.colors.primaryRim,
              backgroundColor: theme.colors.primary,
            }}
          >
            <Text variant="heading" color="onPrimary">
              {initialsOf(me.user.name)}
            </Text>
          </View>
          <View
            style={{
              position: 'absolute',
              right: -6,
              bottom: -6,
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: theme.colors.surface,
              backgroundColor: theme.colors.gold,
            }}
          >
            <Icon name="star" size={16} color="text" />
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" numberOfLines={1}>
            {me.user.name}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {me.user.email}
          </Text>
          {level ? (
            <View style={{ flexDirection: 'row' }}>
              <Pill tone="primarySolid" caps label={`Nível ${level.level}: ${level.title}`} />
            </View>
          ) : null}
        </View>
      </View>
      {level ? (
        <>
          <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text variant="label" color="accentText" style={{ flexShrink: 1 }}>
              {level.nextLevelTitle
                ? `XP para o Nível ${level.level + 1} (${level.nextLevelTitle})`
                : 'Nível máximo alcançado'}
            </Text>
            <Text variant="label" color="accentText">
              {level.nextLevelXp
                ? `${level.xpTotal.toLocaleString('pt-BR')} / ${level.nextLevelXp.toLocaleString('pt-BR')} XP`
                : `${level.xpTotal.toLocaleString('pt-BR')} XP`}
            </Text>
          </View>
          <ProgressBar
            percent={percent}
            accessibilityLabel={`Progresso de XP: ${Math.floor(percent)}%`}
          />
        </>
      ) : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Metric
          value={booksRead === null ? '—' : String(booksRead)}
          label="Livros lidos"
          color="text"
        />
        <Metric
          value={remembered === null ? '—' : `${remembered}%`}
          label="Lembrei (30 dias)"
          color="accentText"
        />
        <Metric
          value={streak === null ? '—' : streak === 1 ? '1 dia' : `${streak} dias`}
          label="Sequência"
          color="warningText"
        />
      </View>
    </Surface>
  );
}

/** Stitch "Conquistas recentes": unlocked first, then the closest locked ones. */
function RecentAchievements({ data }: { data: AchievementsResponse }) {
  const theme = useTheme();
  const router = useRouter();
  const ordered = [...data.achievements].sort(
    (a, b) =>
      Number(b.unlocked) - Number(a.unlocked) || b.progress / b.target - a.progress / a.target,
  );
  return (
    <Surface>
      <SectionTitle
        icon="emoji-events"
        title="Conquistas recentes"
        trailing={
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Ver todas as ${data.achievements.length} conquistas`}
            hitSlop={12}
            onPress={() => {
              haptics.selection();
              router.push('/conquistas');
            }}
          >
            <Text variant="label" color="accentText">
              {`Ver todas (${data.achievements.length})`}
            </Text>
          </Pressable>
        }
      />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {ordered.slice(0, 4).map((achievement) => {
          const meta = CATEGORY_META[achievement.category];
          return (
            <View
              key={achievement.id}
              accessible
              accessibilityLabel={`${achievement.title}: ${achievement.unlocked ? 'conquistada' : `${achievement.progress} de ${achievement.target}`}`}
              style={{ flex: 1, alignItems: 'center', gap: 6 }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderStyle: achievement.unlocked ? 'solid' : 'dashed',
                  borderColor: achievement.unlocked
                    ? theme.colors[meta.strong]
                    : theme.colors.border,
                  backgroundColor: achievement.unlocked
                    ? theme.colors[meta.soft]
                    : theme.colors.surfaceMuted,
                }}
              >
                <Icon
                  name={achievement.unlocked ? achievementIcon(achievement.id) : 'lock-outline'}
                  size={26}
                  color={achievement.unlocked ? meta.strong : 'textMuted'}
                />
              </View>
              <Text
                variant="label"
                color={achievement.unlocked ? 'text' : 'textMuted'}
                align="center"
                numberOfLines={2}
                style={{ fontSize: 11 }}
              >
                {achievement.title}
              </Text>
            </View>
          );
        })}
      </View>
    </Surface>
  );
}

/** Stitch "Meta anual": books finished this calendar year against the reader's own goal. */
function AnnualGoal({ finished, goal }: { finished: number; goal: number | null }) {
  const theme = useTheme();
  const router = useRouter();
  const year = new Date().getFullYear();
  if (goal === null)
    return (
      <ActionRow
        icon="flag"
        title={`Meta anual ${year}`}
        subtitle="Defina quantos livros quer terminar este ano"
        onPress={() => router.push('/configuracoes')}
      />
    );
  const percent = Math.min(100, Math.round((finished / goal) * 100));
  return (
    <Surface>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleSm">{`Meta anual ${year}`}</Text>
          <Text variant="bodySm" color="textMuted">
            {`${finished} de ${goal} ${goal === 1 ? 'livro lido' : 'livros lidos'}`}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={`Meta anual: ${percent}%`}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 5,
            borderColor: percent >= 100 ? theme.colors.success : theme.colors.primary,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <Text variant="label" color="accentText">{`${percent}%`}</Text>
        </View>
      </View>
      <ProgressBar
        percent={percent}
        tone={percent >= 100 ? 'success' : 'primary'}
        size="sm"
        accessibilityLabel={`${finished} de ${goal} livros`}
      />
    </Surface>
  );
}

/** Reading profile from onboarding (habit, goals, genres), as Stitch pills. */
function ReadingProfile({ me }: { me: MeResponse }) {
  const theme = useTheme();
  const habit = HABIT_OPTIONS.find((o) => o.id === me.profile.readingHabit);
  const goals = GOAL_OPTIONS.filter((o) => me.profile.goals.includes(o.id));
  const genres = GENRE_OPTIONS.filter((o) => me.profile.interests.includes(o.id));
  if (!habit && goals.length === 0 && genres.length === 0) return null;
  return (
    <Surface>
      <SectionTitle icon="auto-stories" title="Seu jeito de ler" />
      {habit ? <Pill tone="primary" icon="schedule" label={habit.title} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {goals.map((goal) => (
          <Pill key={goal.id} tone="gold" label={goal.title} />
        ))}
        {genres.map((genre) => (
          <Pill key={genre.id} tone="neutral" label={genre.title} />
        ))}
      </View>
    </Surface>
  );
}

/** Stitch "Meu perfil": who you are, your level, real numbers, badges, goal and settings. */
export default function YouScreen() {
  const router = useRouter();
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const shelf = useShelf(userId);
  const stats = useStats(userId);
  const memory = useMemoryStats(userId, 30);
  const achievements = useAchievements(userId);
  const preferences = usePreferences(userId);
  const signOut = useSignOut();
  const [signingOut, setSigningOut] = useState(false);

  const confirmSignOut = () =>
    Alert.alert('Sair da conta?', 'Você pode entrar de novo quando quiser.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          signOut().finally(() => setSigningOut(false));
        },
      },
    ]);

  const year = new Date().getFullYear();
  const finishedThisYear =
    shelf.data?.entries.filter(
      (entry) =>
        entry.status === 'finished' &&
        entry.finishedAt !== null &&
        new Date(entry.finishedAt).getFullYear() === year,
    ).length ?? 0;
  const attempts = memory.data?.days.reduce(
    (sum, day) => sum + day.remembered + day.almost + day.forgot,
    0,
  );
  const rememberedPercent =
    memory.data && attempts
      ? Math.round(
          (memory.data.days.reduce((sum, day) => sum + day.remembered, 0) / attempts) * 100,
        )
      : null;

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
            Meu Perfil
          </Text>
          {userId ? <NotificationBell userId={userId} /> : null}
          <HeaderButton
            icon="settings"
            label="Preferências"
            iconColor="accentText"
            onPress={() => router.push('/configuracoes')}
          />
        </View>
      }
    >
      {auth.status === 'ready' ? (
        <ProfileCard
          me={auth.me}
          achievements={achievements.data}
          booksRead={
            shelf.data
              ? shelf.data.entries.filter((entry) => entry.status === 'finished').length
              : null
          }
          remembered={rememberedPercent}
          streak={stats.data?.streakDays ?? null}
        />
      ) : null}
      {achievements.data ? <RecentAchievements data={achievements.data} /> : null}
      {preferences.data && shelf.data ? (
        <AnnualGoal finished={finishedThisYear} goal={preferences.data.annualBookGoal} />
      ) : null}
      {auth.status === 'ready' ? <ReadingProfile me={auth.me} /> : null}

      <SectionTitle icon="tune" title="Sua conta" />
      <ActionRow
        icon="insights"
        title="Minha memória"
        subtitle="Revisões por período e por livro"
        onPress={() => router.push('/estatisticas')}
      />
      <ActionRow
        icon="people"
        title="Amigos de leitura"
        subtitle="Pedidos, amigos e privacidade"
        onPress={() => router.push('/amigos')}
      />
      <ActionRow
        icon="psychology"
        title="Preferências cognitivas"
        subtitle="Revisões, metas, lembretes e aparência"
        onPress={() => router.push('/configuracoes')}
      />
      <ActionRow
        icon="notifications"
        title="Notificações"
        subtitle="Lembretes e avisos da comunidade"
        onPress={() => router.push('/notificacoes')}
      />
      <ActionRow
        icon="widgets"
        title="Bubo na sua tela"
        subtitle="Widgets de leitura, ritmo e revisões"
        onPress={() => router.push('/widgets')}
      />
      <ActionRow
        icon="block"
        title="Leitores bloqueados"
        subtitle="Quem você bloqueou nos clubes"
        onPress={() => router.push('/bloqueados')}
      />
      {auth.status === 'ready' && auth.me.isModerator ? (
        <ActionRow
          icon="gavel"
          title="Moderação geral"
          subtitle="Denúncias abertas de todos os clubes"
          onPress={() => router.push('/moderacao')}
        />
      ) : null}
      <Button
        label="Sair da conta"
        variant="secondary"
        size="md"
        icon="logout"
        loading={signingOut}
        onPress={confirmSignOut}
      />
      <LinkButton
        label="Excluir conta"
        color="error"
        accessibilityHint="Abre a tela para excluir sua conta e seus dados"
        onPress={() => router.push('/excluir-conta')}
      />
      {__DEV__ ? (
        <Button
          label="DEV · Design system"
          variant="secondary"
          size="md"
          icon="palette"
          accessibilityHint="Abre a vitrine de componentes (apenas em desenvolvimento)"
          onPress={() => router.push('/dev/showcase')}
        />
      ) : null}
    </Screen>
  );
}
