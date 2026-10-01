import { type MemoryDay, WEEKDAY_LABELS_PT, summarizeMemoryDays } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  SectionHeader,
  SegmentedTabs,
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        accessibilityLabel="Histórico diário de revisões"
      >
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
                style={{ width: 36, alignItems: 'center', gap: theme.spacing.xs }}
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
                  {isToday ? 'HOJE' : dayMonth(day.date)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
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

/** Real review self-assessments and reading activity, never a retention score. */
export default function MemoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const auth = useAuthState();
  const [period, setPeriod] = useState<'7' | '30' | '90' | '365'>('7');
  const periodDays = Number(period) as 7 | 30 | 90 | 365;
  const stats = useMemoryStats(auth.status === 'ready' ? auth.userId : undefined, periodDays);
  const days = stats.data?.days ?? [];
  const summary = summarizeMemoryDays(days);
  const hasData = stats.isSuccess && summary.total > 0;

  return (
    <FormScreen
      title="Minha memória"
      eyebrow={`Últimos ${period} dias`}
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
      <SegmentedTabs
        accessibilityLabel="Período da memória"
        options={[
          { id: '7', label: '7 dias' },
          { id: '30', label: '30 dias' },
          { id: '90', label: '90 dias' },
          { id: '365', label: '365 dias' },
        ]}
        value={period}
        onChange={setPeriod}
      />
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
            description={`Nenhuma revisão registrada nos últimos ${period} dias. Quando você revisar um card, sua avaliação aparece aqui.`}
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
                <Chip label="Seu período de revisões" tone="primary" eyebrow />
                <Text variant="bodyStrong">
                  Você revisou em {summary.activeDays} {summary.activeDays === 1 ? 'dia' : 'dias'}{' '}
                  dos últimos {period}.
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
              <StatTile value={`${summary.activeDays}/${period}`} label="Dias com revisão" />
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
      {stats.isSuccess && stats.data ? (
        <>
          <Card>
            <SectionHeader title="Leitura e foco" icon="bar-chart" />
            <Text variant="bodySm" color="textMuted">
              Nos últimos {period} dias
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <StatTile
                value={String(stats.data.focus.focusedMinutes)}
                label="Minutos de leitura"
              />
              <StatTile value={String(stats.data.focus.readingDays)} label="Dias com leitura" />
            </View>
            <Text variant="bodySm" color="textMuted">
              Sua memória hoje: {stats.data.cardsTotal} cards em {stats.data.booksWithCards} livros.
            </Text>
          </Card>
          {hasData ? (
            <Card>
              <SectionHeader title="Seus horários de revisão" icon="bar-chart" />
              {(
                [
                  ['morning', 'Manhã'],
                  ['afternoon', 'Tarde'],
                  ['evening', 'Noite'],
                  ['dawn', 'Madrugada'],
                ] as const
              ).map(([key, label]) => (
                <Text key={key} variant="bodySm">
                  {label}: {stats.data.dayParts[key].total} revisões ·{' '}
                  {stats.data.dayParts[key].remembered} marcadas como Lembrei
                </Text>
              ))}
              <Text variant="bodySm" color="textMuted">
                Horários locais das suas tentativas, sem classificar o melhor horário para aprender.
              </Text>
            </Card>
          ) : null}
          {stats.data.books.length > 0 ? (
            <Card>
              <SectionHeader title="Memória por livro" icon="bar-chart" />
              {stats.data.books.map((book) => (
                <View key={book.shelfEntryId} style={{ gap: theme.spacing.xs }}>
                  <Text variant="bodyStrong">{book.title}</Text>
                  <Text variant="bodySm" color="textMuted">
                    {book.total} revisões · {book.remembered} marcadas como Lembrei
                  </Text>
                  <Button
                    label={`Abrir ${book.title}`}
                    variant="secondary"
                    size="md"
                    onPress={() =>
                      router.push({ pathname: '/livro/[id]', params: { id: book.shelfEntryId } })
                    }
                  />
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </FormScreen>
  );
}
