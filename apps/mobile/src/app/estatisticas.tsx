import { type MemoryDay, WEEKDAY_LABELS_PT, summarizeMemoryDays } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  SectionHeader,
  Text,
} from '../design-system';
import { useMemoryStats } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { type ColorTokens, useTheme } from '../theme';

const CHART_HEIGHT = 120;

/** Stacked from the bottom: Lembrei, Quase, Esqueci — colours match the review buttons. */
const SERIES: {
  key: 'remembered' | 'almost' | 'forgot';
  label: string;
  color: keyof ColorTokens;
}[] = [
  { key: 'remembered', label: 'Lembrei', color: 'success' },
  { key: 'almost', label: 'Quase', color: 'warning' },
  { key: 'forgot', label: 'Esqueci', color: 'purpleLight' },
];

function weekdayOf(isoDate: string) {
  const [year = 1970, month = 1, day = 1] = isoDate.split('-').map(Number);
  return WEEKDAY_LABELS_PT[(new Date(year, month - 1, day).getDay() + 6) % 7] ?? '';
}

function dayMonth(isoDate: string) {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
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

function DailyChart({ days, busiestDay }: { days: MemoryDay[]; busiestDay: number }) {
  const theme = useTheme();
  const today = days[days.length - 1]?.date;
  return (
    <Card>
      <SectionHeader title="Revisões por dia" icon="bar-chart" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
        {days.map((day) => {
          const count = day.remembered + day.almost + day.forgot;
          const isToday = day.date === today;
          return (
            <View
              key={day.date}
              accessible
              accessibilityLabel={`${weekdayOf(day.date)}, ${dayMonth(day.date)}: ${
                count === 0
                  ? 'nenhuma revisão'
                  : `Lembrei ${day.remembered}, Quase ${day.almost}, Esqueci ${day.forgot}`
              }`}
              style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xs }}
            >
              <Text variant="label" color={count === 0 ? 'textMuted' : 'text'}>
                {count}
              </Text>
              <View
                style={{
                  width: '100%',
                  maxWidth: 28,
                  height: CHART_HEIGHT,
                  justifyContent: 'flex-end',
                  borderRadius: theme.radii.sm,
                  overflow: 'hidden',
                  backgroundColor: theme.colors.surfaceMuted,
                }}
              >
                {[...SERIES].reverse().map((series) =>
                  day[series.key] > 0 ? (
                    <View
                      key={series.key}
                      style={{
                        height: (day[series.key] / busiestDay) * CHART_HEIGHT,
                        backgroundColor: theme.colors[series.color],
                      }}
                    />
                  ) : null,
                )}
              </View>
              <Text variant="caption" color={isToday ? 'accentText' : 'textMuted'}>
                {isToday ? 'HOJE' : weekdayOf(day.date)}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        {SERIES.map((series) => (
          <View
            key={series.key}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors[series.color],
              }}
            />
            <Text variant="bodySm" color="textMuted">
              {series.label}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** "Minha memória": the last seven days of real review self-assessments (never a retention score). */
export default function MemoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const auth = useAuthState();
  const stats = useMemoryStats(auth.status === 'ready' ? auth.userId : undefined);
  const days = stats.data?.days ?? [];
  const summary = summarizeMemoryDays(days);
  const hasData = stats.isSuccess && summary.total > 0;

  return (
    <FormScreen
      title="Minha memória"
      eyebrow="Últimos 7 dias"
      footer={
        hasData ? (
          <Button
            label="Ir para Revisar"
            icon="psychology"
            fullWidth
            onPress={() => router.navigate('/revisar')}
          />
        ) : undefined
      }
    >
      {stats.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando revisões" />
      ) : stats.isError ? (
        <Card>
          <EmptyState
            mascot="offline"
            title="Não conseguimos carregar suas revisões"
            description="Verifique sua conexão e tente novamente."
            action={
              <Button
                label="Tentar de novo"
                variant="secondary"
                size="md"
                icon="refresh"
                onPress={() => void stats.refetch()}
              />
            }
          />
        </Card>
      ) : !hasData ? (
        <Card>
          <EmptyState
            mascot="emptyReview"
            title="Seu histórico começa com uma revisão"
            description="Nenhuma revisão registrada nos últimos 7 dias. Quando você revisar um card, sua avaliação aparece aqui."
            action={
              <Button
                label="Ir para Revisar"
                icon="psychology"
                fullWidth
                onPress={() => router.navigate('/revisar')}
              />
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <BuboMascot state="reviewDue" size={80} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Chip label="Sua semana de revisões" tone="primary" eyebrow />
                <Text variant="bodyStrong">
                  Você revisou em {summary.activeDays} {summary.activeDays === 1 ? 'dia' : 'dias'}{' '}
                  dos últimos 7.
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <StatTile
                value={String(summary.total)}
                label={summary.total === 1 ? 'Revisão' : 'Revisões'}
              />
              <StatTile
                value={`${summary.rememberedPercent ?? 0}%`}
                label="Marcadas como Lembrei"
              />
              <StatTile value={`${summary.activeDays}/7`} label="Dias com revisão" />
            </View>
          </Card>
          <DailyChart days={days} busiestDay={summary.busiestDay} />
          <Card tone="muted">
            <SectionHeader title="Como ler estes números" icon="info-outline" />
            <Text variant="bodySm" color="textMuted">
              Lembrei, Quase e Esqueci mostram como você avaliou cada tentativa de lembrar. São suas
              autoavaliações, não uma medida de retenção.
            </Text>
          </Card>
        </>
      )}
    </FormScreen>
  );
}
