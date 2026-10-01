import {
  type ClubCyclesResponse,
  type ClubDetail,
  createCycleRequestSchema,
} from '@bubo/contracts';
import {
  CYCLE_DURATIONS_DAYS,
  type CycleDurationDays,
  MAX_BOOK_PAGES,
  cycleDaysLeft,
  cycleGroupPercent,
  cycleHistorySummary,
  cycleWeeks,
} from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

import {
  BookCover,
  BuboTip,
  Button,
  Card,
  EmptyState,
  FormScreen,
  Icon,
  InlineMessage,
  Pill,
  ProgressBar,
  Raised,
  SectionTitle,
  Stepper,
  TabChip,
  Text,
} from '../../design-system';
import { pagesLabel } from '../../features/community/meta';
import { ApiError } from '../../lib/api/client';
import {
  useClub,
  useClubCycles,
  useCloseClubCycle,
  useStartClubCycle,
} from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type Cycle = ClubCyclesResponse['cycles'][number] & { number: number };

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "AGO – OUT 2026" or "SET 2026" in the reader's local calendar. */
function monthRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const label = (date: Date) => MONTHS[date.getMonth()] ?? '';
  if (start.getFullYear() !== end.getFullYear())
    return `${label(start)} ${start.getFullYear()} – ${label(end)} ${end.getFullYear()}`;
  if (start.getMonth() === end.getMonth()) return `${label(start)} ${start.getFullYear()}`;
  return `${label(start)} – ${label(end)} ${end.getFullYear()}`;
}

function participantsLabel(atGoal: number, total: number): string {
  return `${atGoal} de ${total} na meta`;
}

/** The book line shared by every cycle card (clubs read one catalog book). */
function CycleBook({ club, coverWidth }: { club: ClubDetail; coverWidth: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
      <BookCover
        title={club.book.title}
        author={club.book.author}
        coverUrls={club.book.coverUrls}
        width={coverWidth}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleSm" numberOfLines={2}>
          {club.book.title}
        </Text>
        <Text variant="bodySm" color="textMuted" numberOfLines={1}>
          {[club.book.author, club.book.totalPages ? `${club.book.totalPages} págs` : null]
            .filter(Boolean)
            .join(' • ')}
        </Text>
      </View>
    </View>
  );
}

/** Stitch "Ciclo atual #4 • em andamento": purple-edged card with the group's real progress. */
function CurrentCycleCard({
  cycle,
  club,
  owner,
  closing,
  onClose,
}: {
  cycle: Cycle;
  club: ClubDetail;
  owner: boolean;
  closing: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const group = cycleGroupPercent(cycle);
  const daysLeft = cycleDaysLeft(new Date(cycle.endsAt), new Date());
  const mine = Math.min(100, Math.floor((cycle.myPagesRead / cycle.goalPages) * 100));
  return (
    <Raised
      faceColor={theme.colors.surface}
      borderColor={theme.colors.primarySoft}
      rimColor={theme.colors.cardShadow}
      radius={22}
      depth={theme.sizes.cardRim}
      faceStyle={{
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        borderLeftWidth: 6,
        borderLeftColor: theme.colors.primary,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: theme.colors.primary,
          }}
        />
        <Text variant="caption" color="accentText" style={{ flex: 1 }}>
          {`Ciclo atual #${cycle.number} • em andamento`}
        </Text>
        <Pill
          tone="warning"
          icon="schedule"
          label={
            daysLeft === 0
              ? 'Termina hoje'
              : daysLeft === 1
                ? '1 dia restante'
                : `${daysLeft} dias restantes`
          }
        />
      </View>
      <CycleBook club={club} coverWidth={60} />
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="label">Progresso do grupo</Text>
          <Text variant="label" color="accentText">{`${group}%`}</Text>
        </View>
        <ProgressBar
          percent={group}
          accessibilityLabel={`Progresso do grupo: ${group}% da meta de ${cycle.goalPages} páginas por participante`}
        />
        <Text variant="bodySm" color="textMuted">
          {`Meta: ${pagesLabel(cycle.goalPages)} por pessoa • ${participantsLabel(cycle.participantsAtGoal, cycle.participantCount)}`}
        </Text>
      </View>
      {cycle.participating ? (
        <View style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="label">Você</Text>
            <Text variant="label" color="successText">
              {`${cycle.myPagesRead}/${cycle.goalPages} págs`}
            </Text>
          </View>
          <ProgressBar
            percent={mine}
            tone="success"
            size="sm"
            accessibilityLabel={`Você leu ${cycle.myPagesRead} de ${cycle.goalPages} páginas neste ciclo`}
          />
        </View>
      ) : (
        <Text variant="bodySm" color="textMuted">
          Você entrou no clube depois do início deste ciclo; participa do próximo.
        </Text>
      )}
      {owner ? (
        <Button
          label="Encerrar ciclo"
          icon="flag"
          variant="secondary"
          size="md"
          loading={closing}
          onPress={onClose}
        />
      ) : null}
    </Raised>
  );
}

/** Stitch archived cycle: "Ciclo #3 concluído • ago – out 2026", weeks, goal pill and totals. */
function ClosedCycleCard({ cycle, club }: { cycle: Cycle; club: ClubDetail }) {
  const theme = useTheme();
  const end = cycle.closedAt ?? cycle.endsAt;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Pill
            tone="neutral"
            caps
            label={`Ciclo #${cycle.number} concluído • ${monthRange(cycle.startedAt, end)}`}
          />
        </View>
        <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
          {(() => {
            const weeks = cycleWeeks(new Date(cycle.startedAt), new Date(end));
            return weeks === 1 ? '1 semana' : `${weeks} semanas`;
          })()}
        </Text>
      </View>
      <CycleBook club={club} coverWidth={48} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        <Pill
          tone="gold"
          icon="star-outline"
          label={participantsLabel(cycle.participantsAtGoal, cycle.participantCount)}
        />
        <Pill tone="primary" icon="auto-stories" label={`${pagesLabel(cycle.totalPagesRead)}`} />
        {cycle.participating ? (
          <Pill
            tone={cycle.myPagesRead >= cycle.goalPages ? 'success' : 'neutral'}
            icon="person"
            label={`Você: ${cycle.myPagesRead}/${cycle.goalPages}`}
          />
        ) : null}
      </View>
    </Card>
  );
}

/** Owner form to open the next cycle: pages per participant and duration. */
function StartCycleCard({ club, userId }: { club: ClubDetail; userId: string }) {
  const theme = useTheme();
  const start = useStartClubCycle(userId, club.id);
  const id = useRef(Crypto.randomUUID());
  const maxPages = club.book.totalPages ?? MAX_BOOK_PAGES;
  const [goal, setGoal] = useState(String(Math.min(club.weeklyGoalPages ?? 50, maxPages)));
  const [duration, setDuration] = useState<CycleDurationDays>(14);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (start.isPending) return;
    const input = createCycleRequestSchema.safeParse({
      id: id.current,
      goalPages: /^\d+$/.test(goal.trim()) ? Number(goal.trim()) : 0,
      durationDays: duration,
    });
    if (!input.success || input.data.goalPages > maxPages) {
      setError(`Escolha uma meta entre 1 e ${maxPages} páginas.`);
      return;
    }
    setError(null);
    try {
      await start.mutateAsync(input.data);
      haptics.success();
      id.current = Crypto.randomUUID();
    } catch (e) {
      haptics.error();
      setError(
        e instanceof ApiError && e.code === 'CONFLICT'
          ? 'Já existe um ciclo em andamento. Atualize a tela.'
          : 'Não foi possível iniciar o ciclo agora.',
      );
    }
  }

  return (
    <Card>
      <SectionTitle icon="add-circle-outline" title="Abrir o próximo ciclo" />
      <Text variant="bodySm" color="textMuted">
        Os membros de agora participam. O progresso vem das sessões de leitura deste livro durante o
        ciclo.
      </Text>
      <Stepper
        label="Páginas por participante"
        value={goal}
        onChangeText={setGoal}
        min={1}
        max={maxPages}
        step={10}
      />
      <Text variant="label">Duração</Text>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
      >
        {CYCLE_DURATIONS_DAYS.map((days) => (
          <TabChip
            key={days}
            role="radio"
            label={`${days} dias`}
            selected={duration === days}
            onPress={() => setDuration(days)}
          />
        ))}
      </View>
      {error ? <InlineMessage tone="error" message={error} /> : null}
      <Button
        label="Iniciar ciclo"
        icon="play-arrow"
        fullWidth
        loading={start.isPending}
        onPress={() => void create()}
      />
    </Card>
  );
}

/**
 * Stitch "Histórico de ciclos de leitura" (club): Bubo historian, real totals, year filter, the
 * cycle in progress and the timeline of finished cycles. All progress comes from sessions.
 */
export default function ClubCyclesScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ clubId: string }>();
  const clubId = typeof params.clubId === 'string' ? params.clubId : '';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const club = useClub(userId || undefined, clubId);
  const cycles = useClubCycles(userId || undefined, clubId);
  const close = useCloseClubCycle(userId, clubId);
  const [year, setYear] = useState<number | null>(null);

  const frame = (children: ReactNode) => (
    <FormScreen align="left" eyebrow="Histórico do clube" title="Ciclos & leituras anteriores">
      {children}
    </FormScreen>
  );
  if (club.isPending || cycles.isPending)
    return frame(
      <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando ciclos" />,
    );
  if (club.isError || cycles.isError)
    return frame(
      <EmptyState
        mascot="offline"
        title="Não foi possível carregar os ciclos"
        description="Verifique sua conexão e seu acesso ao clube."
        action={
          <Button
            label="Tentar de novo"
            icon="refresh"
            onPress={() => {
              void club.refetch();
              void cycles.refetch();
            }}
          />
        }
      />,
    );

  const data = club.data;
  const owner = data.membership === 'owner';
  const all: Cycle[] = cycles.data.cycles.map((cycle, index, list) => ({
    ...cycle,
    number: list.length - index,
  }));
  const active = all.find((cycle) => cycle.active) ?? null;
  const closed = all.filter((cycle) => !cycle.active);
  const summary = cycleHistorySummary(closed);
  const years = [...new Set(closed.map((cycle) => new Date(cycle.startedAt).getFullYear()))];
  const visible =
    year === null
      ? closed
      : closed.filter((cycle) => new Date(cycle.startedAt).getFullYear() === year);

  const confirmClose = (cycle: Cycle) =>
    Alert.alert(
      `Encerrar o ciclo #${cycle.number}?`,
      'O resultado vai para o histórico e um novo ciclo pode ser aberto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          onPress: () =>
            close.mutate(cycle.id, {
              onSuccess: () => haptics.success(),
              onError: () => haptics.error(),
            }),
        },
      ],
    );

  return (
    <FormScreen align="left" eyebrow="Histórico do clube" title="Ciclos & leituras anteriores">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success }}
        />
        <Text variant="bodySm" color="accentText" numberOfLines={1} style={{ flexShrink: 1 }}>
          {data.name}
        </Text>
        <Text variant="bodySm" color="textMuted">
          {summary.completed === 1
            ? '• 1 ciclo concluído'
            : `• ${summary.completed} ciclos concluídos`}
        </Text>
      </View>

      <Card>
        <BuboTip pose="achievement" title="Bubo historiador" titleIcon="auto-awesome" tone="soft">
          <Text variant="bodySm">
            {summary.completed === 0
              ? active
                ? `O primeiro ciclo de ${data.book.title} está em andamento. Cada sessão conta.`
                : 'Ciclos dão ritmo ao clube: uma meta de páginas, um prazo e todo mundo junto.'
              : `Nos ciclos concluídos, o clube registrou ${pagesLabel(summary.pagesRead)} de ${data.book.title}.`}
          </Text>
        </BuboTip>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {[
            { value: String(summary.completed), label: 'Concluídos', color: 'accentText' as const },
            {
              value: summary.goalRate === null ? '—' : `${summary.goalRate}%`,
              label: 'Na meta',
              color: 'successText' as const,
            },
            {
              value: String(summary.pagesRead),
              label: 'Páginas',
              color: 'warningText' as const,
            },
          ].map((stat) => (
            <View
              key={stat.label}
              accessible
              accessibilityLabel={`${stat.label}: ${stat.value}`}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 2,
                paddingVertical: theme.spacing.md,
                borderRadius: theme.radii.md,
                borderWidth: theme.sizes.borderWidth,
                borderColor: theme.colors.borderSoft,
              }}
            >
              <Text variant="titleSm" color={stat.color}>
                {stat.value}
              </Text>
              <Text variant="caption" color="textMuted">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {years.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -theme.sizes.gutter }}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.sizes.gutter }}
        >
          <TabChip
            role="radio"
            label={`Todos (${closed.length})`}
            selected={year === null}
            onPress={() => setYear(null)}
          />
          {years.map((value) => (
            <TabChip
              key={value}
              role="radio"
              label={String(value)}
              count={
                closed.filter((cycle) => new Date(cycle.startedAt).getFullYear() === value).length
              }
              selected={year === value}
              onPress={() => setYear(value)}
            />
          ))}
        </ScrollView>
      ) : null}

      {active ? (
        <CurrentCycleCard
          cycle={active}
          club={data}
          owner={owner}
          closing={close.isPending}
          onClose={() => confirmClose(active)}
        />
      ) : owner ? (
        <StartCycleCard club={data} userId={userId} />
      ) : (
        <Card tone="muted">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Icon name="event-available" size={20} color="accentText" />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {`Nenhum ciclo em andamento. ${data.ownerName} pode abrir o próximo.`}
            </Text>
          </View>
        </Card>
      )}
      {close.isError ? (
        <InlineMessage tone="error" message="Não foi possível encerrar o ciclo agora." />
      ) : null}

      <SectionTitle
        icon="history"
        title="Linha do tempo de ciclos concluídos"
        trailing={
          closed.length ? (
            <Text variant="label" color="accentText">
              {closed.length === 1 ? '1 arquivado' : `${closed.length} arquivados`}
            </Text>
          ) : undefined
        }
      />
      {visible.length === 0 ? (
        <Text variant="bodySm" color="textMuted">
          Os ciclos encerrados aparecem aqui, com quantas pessoas chegaram à meta.
        </Text>
      ) : (
        visible.map((cycle) => <ClosedCycleCard key={cycle.id} cycle={cycle} club={data} />)
      )}
    </FormScreen>
  );
}
