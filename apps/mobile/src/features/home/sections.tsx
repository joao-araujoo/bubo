import { buildCognitiveWeek, countActiveDays } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  SectionHeader,
  Text,
  WeekStrip,
} from '../../design-system';
import { useTheme } from '../../theme';
import { estimatedMinutes } from '../recall/grades';

/**
 * Home ("Hoje") sections in the north-star order:
 * Lendo agora → Recuperação ativa → Sua semana cognitiva → Missão de hoje → secondary content.
 * "Lendo agora", the week and the mission come from real shelf/session data; recall arrives in a
 * later task and stays an honest shell.
 */

/** "Recuperação ativa": real due cards (from session reflections and the reader's own cards). */
export function ActiveRecallSection({
  dueCount,
  totalCards,
}: {
  /** null while loading. */
  dueCount: number | null;
  totalCards: number | null;
}) {
  const theme = useTheme();
  const router = useRouter();

  if (dueCount && dueCount > 0) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Chip label="Recuperação ativa" tone="primary" eyebrow />
          <Text variant="bodySm" color="textMuted">
            ~{estimatedMinutes(dueCount)} min
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BuboMascot state="recallPrompt" size={80} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            Hora de lembrar sem espiar. O que ficou das suas últimas leituras?
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Chip
            label={dueCount === 1 ? '1 card pendente' : `${dueCount} cards pendentes`}
            tone="neutral"
            icon="style"
          />
          <Button
            label="Revisar agora"
            icon="play-arrow"
            variant="success"
            size="md"
            style={{ flex: 1 }}
            onPress={() => router.push('/revisao')}
          />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Chip label="Recuperação ativa" tone="primary" eyebrow />
      <EmptyState
        compact
        mascot="emptyReview"
        title={totalCards ? 'Tudo revisado por hoje' : 'Nada para revisar por agora'}
        description={
          totalCards
            ? 'Seus cards voltam no dia certo para fixar a memória.'
            : 'Ao terminar uma sessão, escreva o que ficou com você: amanhã isso vira uma pergunta para lembrar sem espiar.'
        }
      />
      <Button
        label={totalCards ? 'Ver revisões' : 'Como funciona a revisão'}
        variant="secondary"
        size="md"
        fullWidth
        onPress={() => router.navigate('/revisar')}
      />
    </Card>
  );
}

export function CognitiveWeekSection({
  activeDates,
  focusedMinutes,
}: {
  activeDates: ReadonlySet<string>;
  /** Focused reading minutes this week (null while loading). */
  focusedMinutes: number | null;
}) {
  const theme = useTheme();
  const week = useMemo(() => buildCognitiveWeek(new Date(), activeDates), [activeDates]);
  const active = countActiveDays(week);
  return (
    <Card>
      <SectionHeader
        title="Sua semana cognitiva"
        icon="bolt"
        iconColor="gold"
        trailing={
          <Text variant="label" color="accentText">
            {active}/7 dias
          </Text>
        }
      />
      <WeekStrip days={week} />
      <Text variant="bodySm" color="textMuted" style={{ marginTop: theme.spacing.xs }}>
        {focusedMinutes
          ? `${focusedMinutes} ${focusedMinutes === 1 ? 'minuto' : 'minutos'} de leitura focada nesta semana.`
          : 'Cada dia com leitura focada ou revisão acende um círculo.'}
      </Text>
    </Card>
  );
}

/**
 * Today's mission is derived from real data: one focused reading session today.
 * (Mission rewards and variety arrive with the recall system — nothing is promised here.)
 */
export function DailyMissionSection({
  readToday,
  readingEntryId,
}: {
  readToday: boolean | null;
  /** The book in progress, if any (the mission's call to action). */
  readingEntryId: string | null;
}) {
  const router = useRouter();
  const done = readToday === true;
  return (
    <Card>
      <SectionHeader
        title="Missão de hoje"
        icon="track-changes"
        trailing={
          done ? (
            <Chip label="Concluída" tone="success" icon="check" iconColor="onSuccess" />
          ) : undefined
        }
      />
      <Text variant="bodyStrong">
        {done
          ? 'Você já leu com foco hoje. Até amanhã!'
          : 'Faça uma sessão de leitura focada hoje.'}
      </Text>
      <Text variant="bodySm" color="textMuted">
        {done
          ? 'Voltar amanhã mantém sua sequência acesa.'
          : 'Um capítulo com atenção total já vale — sem celular, sem pressa.'}
      </Text>
      {!done && readingEntryId ? (
        <Button
          label="Começar agora"
          icon="play-arrow"
          variant="secondary"
          size="md"
          fullWidth
          onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: readingEntryId } })}
        />
      ) : null}
      {!done && !readingEntryId && readToday !== null ? (
        <Button
          label="Escolher um livro"
          icon="menu-book"
          variant="secondary"
          size="md"
          fullWidth
          onPress={() => router.navigate('/estante')}
        />
      ) : null}
    </Card>
  );
}

const STEPS = [
  { title: 'Leia com foco', description: 'Sessões curtas, sem distrações, no seu ritmo.' },
  { title: 'Lembre sem espiar', description: 'Explique com suas palavras o que ficou.' },
  { title: 'Revise no momento certo', description: 'Revisões espaçadas fixam as ideias centrais.' },
] as const;

export function HowBuboWorksSection() {
  const theme = useTheme();
  return (
    <Card tone="muted">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BuboMascot pose="idea" size={64} />
        <Text variant="titleSm" style={{ flex: 1 }} accessibilityRole="header">
          Como o Bubo ajuda você a ler de verdade
        </Text>
      </View>
      {STEPS.map((step, index) => (
        <View key={step.title} style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="label" color="onPrimary">
              {index + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{step.title}</Text>
            <Text variant="bodySm" color="textMuted">
              {step.description}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}
