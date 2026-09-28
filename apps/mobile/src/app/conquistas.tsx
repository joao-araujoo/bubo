import { type Achievement, type AchievementsResponse } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  Icon,
  ProgressBar,
  SectionHeader,
  Text,
} from '../design-system';
import { CATEGORY_META, CATEGORY_ORDER, achievementIcon } from '../features/achievements/meta';
import { useAchievements } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { useTheme } from '../theme';

function LevelCard({ data }: { data: AchievementsResponse }) {
  const theme = useTheme();
  const { level } = data;
  const span = level.nextLevelXp === null ? null : level.nextLevelXp - level.levelStartXp;
  const percent = span ? ((level.xpTotal - level.levelStartXp) / span) * 100 : 100;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BuboMascot state="achievementUnlocked" size={88} />
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Chip label={`Nível ${level.level}`} tone="gold" icon="star" iconColor="goldRim" />
          <Text variant="title" accessibilityRole="header">
            {level.title}
          </Text>
          <Text variant="bodySm" color="textMuted">
            {level.nextLevelXp === null
              ? 'Você chegou ao nível mais alto. Continue lendo e revisando.'
              : `Faltam ${level.nextLevelXp - level.xpTotal} XP para ${level.nextLevelTitle ?? 'o próximo nível'}.`}
          </Text>
        </View>
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="label" color="textMuted">
            {level.nextLevelXp === null ? 'Nível máximo' : `Rumo ao nível ${level.level + 1}`}
          </Text>
          <Text variant="label" color="accentText">
            {level.nextLevelXp === null
              ? `${level.xpTotal} XP`
              : `${level.xpTotal} / ${level.nextLevelXp} XP`}
          </Text>
        </View>
        <ProgressBar
          percent={percent}
          accessibilityLabel={`Progresso para o próximo nível: ${Math.round(percent)}%`}
        />
      </View>
    </Card>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flex: 1,
        padding: theme.spacing.sm,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surfaceMuted,
        alignItems: 'center',
        gap: theme.spacing.xxs,
      }}
    >
      <Text variant="titleSm" color="accentText">
        {value}
      </Text>
      <Text variant="bodySm" color="textMuted" align="center">
        {label}
      </Text>
    </View>
  );
}

function BadgeCard({ achievement }: { achievement: Achievement }) {
  const theme = useTheme();
  const meta = CATEGORY_META[achievement.category];
  const { unlocked } = achievement;
  const percent = (achievement.progress / achievement.target) * 100;
  return (
    <View
      accessible
      accessibilityLabel={`${achievement.title}. ${achievement.description} ${
        unlocked ? 'Conquistada.' : `Progresso: ${achievement.progress} de ${achievement.target}.`
      }`}
      style={{
        flex: 1,
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radii.lg,
        borderWidth: theme.sizes.borderWidth,
        borderStyle: unlocked ? 'solid' : 'dashed',
        borderColor: unlocked ? theme.colors[meta.strong] : theme.colors.border,
        backgroundColor: unlocked ? theme.colors.surface : theme.colors.surfaceMuted,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: theme.radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: unlocked ? theme.colors[meta.soft] : theme.colors.surface,
        }}
      >
        <Icon
          name={unlocked ? achievementIcon(achievement.id) : 'lock-outline'}
          size={26}
          color={unlocked ? meta.strong : 'textMuted'}
        />
      </View>
      <Text variant="bodyStrong" color={unlocked ? 'text' : 'textMuted'}>
        {achievement.title}
      </Text>
      <Text variant="bodySm" color="textMuted" style={{ flexGrow: 1 }}>
        {achievement.description}
      </Text>
      {unlocked ? (
        <Chip label="Conquistada" tone="success" icon="check" />
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          <ProgressBar
            percent={percent}
            accessibilityLabel={`${achievement.title}: ${achievement.progress} de ${achievement.target}`}
          />
          <Text variant="caption" color="textMuted">
            {achievement.progress} / {achievement.target}
          </Text>
        </View>
      )}
    </View>
  );
}

function Category({ items }: { items: Achievement[] }) {
  const theme = useTheme();
  const first = items[0];
  if (!first) return null;
  const meta = CATEGORY_META[first.category];
  const rows: Achievement[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionHeader
        title={meta.title}
        icon={meta.icon}
        trailing={
          <Text variant="bodySm" color="textMuted">
            {items.filter((item) => item.unlocked).length}/{items.length}
          </Text>
        }
      />
      {rows.map((row) => (
        <View
          key={row.map((item) => item.id).join('-')}
          style={{ flexDirection: 'row', gap: theme.spacing.sm }}
        >
          {row.map((item) => (
            <BadgeCard key={item.id} achievement={item} />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** "Mural de conquistas": level and badges recomputed from real activity (ADR-018). */
export default function AchievementsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const query = useAchievements(auth.status === 'ready' ? auth.userId : undefined);

  return (
    <FormScreen title="Mural de conquistas" eyebrow="Gamificação Bubo">
      {query.isPending ? (
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="Carregando conquistas"
        />
      ) : query.isError ? (
        <Card>
          <EmptyState
            mascot="offline"
            title="Não conseguimos carregar suas conquistas"
            description="Verifique sua conexão e tente novamente."
            action={
              <Button
                label="Tentar de novo"
                variant="secondary"
                size="md"
                icon="refresh"
                onPress={() => void query.refetch()}
              />
            }
          />
        </Card>
      ) : (
        <>
          <LevelCard data={query.data} />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <StatTile
              value={`${query.data.unlockedCount}/${query.data.achievements.length}`}
              label="Conquistas"
            />
            <StatTile value={`${query.data.streakDays}`} label="Dias de sequência" />
            <StatTile value={`${query.data.longestStreakDays}`} label="Maior sequência" />
          </View>
          {query.data.unlockedCount === 0 ? (
            <Card tone="muted">
              <Text variant="bodySm" color="textMuted">
                Cada conquista vem do que você registra: sessões de leitura, revisões e livros
                terminados. A primeira aparece depois da sua primeira sessão.
              </Text>
              <Button
                label="Ir para a Estante"
                icon="menu-book"
                size="md"
                fullWidth
                onPress={() => router.navigate('/estante')}
              />
            </Card>
          ) : null}
          {CATEGORY_ORDER.map((category) => (
            <Category
              key={category}
              items={query.data.achievements.filter((item) => item.category === category)}
            />
          ))}
        </>
      )}
    </FormScreen>
  );
}
