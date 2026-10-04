import { type ShelfEntry } from '@bubo/contracts';
import { type TodayAction } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  InlineMessage,
  Text,
} from '../../design-system';
import { useTheme } from '../../theme';
import { estimatedMinutes } from '../recall/grades';
import { RecoveryCard } from '../session/RecoveryCard';
import { ReadingBookSummary } from './ReadingNowSection';

/** Only the chosen next step has a primary button; week and focus remain quiet context. */
export function NextStepSection({
  action,
  reading,
  waitingForNetwork,
  onRetry,
}: {
  action: TodayAction;
  reading: ShelfEntry | null;
  waitingForNetwork: boolean;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const openBook = (id: string) => router.push({ pathname: '/livro/[id]', params: { id } });
  const start = (id: string, fiveMinutes = false) =>
    router.push({
      pathname: '/sessao/[id]',
      params: { id, ...(fiveMinutes ? { goal: '5' } : {}) },
    });

  if (action.kind === 'recover') return <RecoveryCard draft={action} />;
  if (action.kind === 'loading')
    return (
      <Card>
        <Text variant="titleSm">Seu próximo passo</Text>
        {waitingForNetwork ? (
          <InlineMessage tone="info" message="Conecte-se para carregar suas leituras e revisões." />
        ) : (
          <ActivityIndicator
            color={theme.colors.primary}
            accessibilityLabel="Carregando seu próximo passo"
          />
        )}
      </Card>
    );
  if (action.kind === 'retry')
    return (
      <Card>
        <InlineMessage
          tone="error"
          message={
            action.source === 'draft'
              ? 'Não foi possível recuperar sua sessão neste aparelho.'
              : 'Não foi possível carregar suas leituras e revisões.'
          }
        />
        <Button label="Tentar de novo" icon="refresh" fullWidth onPress={onRetry} />
      </Card>
    );

  if (action.kind === 'choose')
    return (
      <Card>
        <EmptyState
          compact
          mascot="emptyShelf"
          title="Qual vai ser sua próxima leitura?"
          description="Escolha um livro na Estante para começar."
        />
        <Button
          label="Escolher um livro"
          icon="menu-book"
          fullWidth
          onPress={() => router.navigate('/estante')}
        />
      </Card>
    );

  if (action.kind === 'review')
    return (
      <View style={{ gap: theme.spacing.lg }}>
        <Card>
          <Chip label="Seu próximo passo" tone="primary" eyebrow />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <BuboMascot state="recallPrompt" size={80} />
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text variant="titleSm">Hora de lembrar sem espiar.</Text>
              <Text variant="bodySm" color="textMuted">
                {action.count === 1 ? '1 card disponível' : `${action.count} cards disponíveis`} · ~
                {estimatedMinutes(action.count)} min
              </Text>
            </View>
          </View>
          <Button
            label="Revisar agora"
            icon="play-arrow"
            fullWidth
            onPress={() => router.push('/revisao')}
          />
        </Card>
        {reading ? (
          <Card>
            <Chip label="Lendo agora" tone="primary" eyebrow />
            <ReadingBookSummary entry={reading} />
            <Button
              label="Ler só 5 minutos"
              icon="timer"
              variant="secondary"
              fullWidth
              onPress={() => start(reading.id, true)}
            />
            <Button
              label="Ver livro"
              icon="menu-book"
              variant="secondary"
              size="md"
              fullWidth
              accessibilityHint="Abre o progresso e as anotações do livro"
              onPress={() => openBook(reading.id)}
            />
          </Card>
        ) : null}
      </View>
    );

  return (
    <Card>
      <Chip label="Seu próximo passo" tone="primary" eyebrow />
      <Text variant="titleSm" accessibilityRole="header">
        {action.kind === 'return'
          ? 'Cinco minutos para voltar'
          : action.kind === 'continue'
            ? 'Mais um pouco do seu livro?'
            : 'Um momento para ler'}
      </Text>
      {action.kind === 'return' ? (
        <Text variant="bodySm" color="textMuted">
          Sua última leitura registrada foi há {action.awayDays} dias. Volte no seu ritmo.
        </Text>
      ) : null}
      {reading ? <ReadingBookSummary entry={reading} /> : null}
      <Button
        label={action.kind === 'return' ? 'Ler só 5 minutos' : 'Continuar leitura'}
        icon={action.kind === 'return' ? 'timer' : 'play-arrow'}
        fullWidth
        onPress={() => start(action.shelfEntryId, action.kind === 'return')}
      />
      <Button
        label={action.kind === 'return' ? 'Começar sem meta de tempo' : 'Ler só 5 minutos'}
        icon={action.kind === 'return' ? 'play-arrow' : 'timer'}
        variant="secondary"
        fullWidth
        onPress={() => start(action.shelfEntryId, action.kind !== 'return')}
      />
      <Button
        label="Ver livro"
        icon="menu-book"
        variant="secondary"
        size="md"
        fullWidth
        accessibilityHint="Abre o progresso e as anotações do livro"
        onPress={() => openBook(action.shelfEntryId)}
      />
    </Card>
  );
}
