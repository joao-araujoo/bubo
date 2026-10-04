import { buildCognitiveWeek, countActiveDays } from '@bubo/domain';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Card, Chip, ProgressBar, SectionHeader, Text, WeekStrip } from '../../design-system';
import { useTheme } from '../../theme';

/** Home sections use the reader's real shelf, sessions and review queue. */

export function CognitiveWeekSection({
  activeDates,
  focusedMinutes,
}: {
  /** null while the actual activity has not loaded. */
  activeDates: ReadonlySet<string> | null;
  /** Focused reading minutes this week (null while loading). */
  focusedMinutes: number | null;
}) {
  const theme = useTheme();
  const week = useMemo(
    () => buildCognitiveWeek(new Date(), activeDates ?? new Set()),
    [activeDates],
  );
  const active = countActiveDays(week);
  return (
    <Card>
      <SectionHeader
        title="Sua semana"
        icon="bolt"
        iconColor="gold"
        trailing={
          <Text variant="label" color="accentText">
            {activeDates === null ? '—/7 dias' : `${active}/7 dias`}
          </Text>
        }
      />
      {activeDates === null ? (
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="Carregando atividade da semana"
        />
      ) : (
        <WeekStrip days={week} />
      )}
      <Text variant="bodySm" color="textMuted" style={{ marginTop: theme.spacing.xs }}>
        {focusedMinutes === null ? '— min de foco' : `${focusedMinutes} min de foco`}
      </Text>
    </Card>
  );
}

/**
 * The focus goal is derived from real reading, without duplicating the next step's action.
 */
export function DailyMissionSection({
  readToday,
  focusedMinutesToday,
  goalMinutes,
}: {
  readToday: boolean | null;
  /** Real focused minutes today and the reader's daily goal (Preferências, Task 09). */
  focusedMinutesToday: number | null;
  goalMinutes: number | null;
}) {
  const theme = useTheme();
  const hasGoal = goalMinutes !== null && focusedMinutesToday !== null;
  const done = hasGoal && focusedMinutesToday >= goalMinutes;
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
        {readToday === null || focusedMinutesToday === null
          ? 'Seu foco de hoje aparece ao carregar o histórico.'
          : goalMinutes === null
            ? `${focusedMinutesToday} min de foco registrados hoje.`
            : done
              ? `Meta de ${goalMinutes} min cumprida.`
              : `Leia ${goalMinutes} minutos com foco hoje.`}
      </Text>
      {hasGoal ? (
        <View style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="label" color="textMuted">
              Foco hoje
            </Text>
            <Text variant="label" color={done ? 'successText' : 'accentText'}>
              {`${Math.min(focusedMinutesToday, goalMinutes)} / ${goalMinutes} min`}
            </Text>
          </View>
          <ProgressBar
            percent={Math.min(100, (focusedMinutesToday / goalMinutes) * 100)}
            tone={done ? 'success' : 'primary'}
            size="sm"
            accessibilityLabel={`${focusedMinutesToday} de ${goalMinutes} minutos de foco hoje`}
          />
        </View>
      ) : null}
    </Card>
  );
}
