import { type ClubDetail, createCycleRequestSchema } from '@bubo/contracts';
import * as Crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  InlineMessage,
  ProgressBar,
  Text,
  TextField,
  ToggleChip,
} from '../../../design-system';
import { useClubCycles, useCloseClubCycle, useStartClubCycle } from '../../../lib/api/queries';
import { useTheme } from '../../../theme';

export function CyclesTab({ club, userId }: { club: ClubDetail; userId: string }) {
  const theme = useTheme();
  const cycles = useClubCycles(userId, club.id);
  const start = useStartClubCycle(userId, club.id);
  const close = useCloseClubCycle(userId, club.id);
  const id = useRef(Crypto.randomUUID());
  const [goal, setGoal] = useState(
    String(Math.min(club.weeklyGoalPages ?? 50, club.book.totalPages ?? 50)),
  );
  const [duration, setDuration] = useState<7 | 14 | 30 | 60 | 90>(14);
  const [error, setError] = useState<string | null>(null);
  const active = cycles.data?.cycles.some((cycle) => cycle.active) ?? false;
  async function create() {
    if (start.isPending) return;
    const input = createCycleRequestSchema.safeParse({
      id: id.current,
      goalPages: /^\d+$/.test(goal) ? Number(goal) : 0,
      durationDays: duration,
    });
    if (!input.success || Number(goal) > (club.book.totalPages ?? 20000)) {
      setError('Informe uma meta válida de páginas para este livro.');
      return;
    }
    setError(null);
    try {
      await start.mutateAsync(input.data);
      id.current = Crypto.randomUUID();
    } catch {
      setError(
        'Não foi possível iniciar. Pode já existir um ciclo ativo; atualize a lista e tente novamente.',
      );
    }
  }
  return (
    <>
      <Text variant="bodySm" color="textMuted">
        Cada ciclo convida os membros presentes no início a ler uma quantidade de páginas deste
        livro. O progresso vem de sessões concluídas durante o ciclo, sem expor reflexões.
      </Text>
      <Button
        label="Atualizar ciclos"
        variant="secondary"
        size="md"
        onPress={() => void cycles.refetch()}
      />
      {cycles.isPending ? (
        <ActivityIndicator accessibilityLabel="Carregando ciclos" />
      ) : cycles.isError ? (
        <InlineMessage tone="error" message="Não foi possível carregar os ciclos." />
      ) : (
        <>
          {cycles.data.cycles.length === 0 ? (
            <EmptyState
              mascot="emptyCommunity"
              title="Um novo momento de leitura"
              description="O criador do clube pode iniciar o primeiro ciclo."
            />
          ) : (
            cycles.data.cycles.map((cycle) => (
              <Card key={cycle.id}>
                <Text variant="titleSm">
                  {cycle.active ? 'Ciclo em andamento' : 'Ciclo encerrado'}
                </Text>
                <Text variant="bodySm">
                  {new Date(cycle.startedAt).toLocaleDateString('pt-BR')} até{' '}
                  {new Date(cycle.closedAt ?? cycle.endsAt).toLocaleDateString('pt-BR')} · Meta:{' '}
                  {cycle.goalPages} páginas por participante
                </Text>
                <Text variant="bodySm">
                  {cycle.participantsAtGoal} de {cycle.participantCount} participantes atingiram a
                  meta · {cycle.totalPagesRead} páginas registradas
                </Text>
                {cycle.participating ? (
                  <>
                    <Text variant="label">
                      Seu progresso: {cycle.myPagesRead}/{cycle.goalPages} páginas
                    </Text>
                    <ProgressBar
                      percent={Math.min(
                        100,
                        Math.floor((cycle.myPagesRead / cycle.goalPages) * 100),
                      )}
                      accessibilityLabel={`Você leu ${cycle.myPagesRead} de ${cycle.goalPages} páginas no ciclo`}
                    />
                  </>
                ) : (
                  <Text variant="bodySm" color="textMuted">
                    Você não estava entre os participantes no início deste ciclo.
                  </Text>
                )}
                {cycle.active && club.membership === 'owner' ? (
                  <Button
                    label="Encerrar ciclo"
                    variant="secondary"
                    disabled={close.isPending}
                    onPress={() =>
                      Alert.alert(
                        'Encerrar este ciclo?',
                        'O histórico permanece disponível e um novo ciclo poderá ser iniciado.',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Encerrar', onPress: () => close.mutate(cycle.id) },
                        ],
                      )
                    }
                  />
                ) : null}
              </Card>
            ))
          )}
          {!active && club.membership === 'owner' ? (
            <Card>
              <Text variant="titleSm">Iniciar próximo ciclo</Text>
              <TextField
                label="Páginas por participante"
                keyboardType="number-pad"
                value={goal}
                onChangeText={setGoal}
                maxLength={5}
              />
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Duração do ciclo"
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
              >
                {([7, 14, 30, 60, 90] as const).map((days) => (
                  <ToggleChip
                    key={days}
                    role="radio"
                    label={`${days} dias`}
                    icon="event"
                    selected={duration === days}
                    onPress={() => setDuration(days)}
                  />
                ))}
              </View>
              <Button label="Iniciar ciclo" loading={start.isPending} onPress={create} />
            </Card>
          ) : null}
        </>
      )}
      {error || close.isError ? (
        <InlineMessage
          tone="error"
          message={error ?? 'Não foi possível encerrar o ciclo. Atualize e tente novamente.'}
        />
      ) : null}
    </>
  );
}
