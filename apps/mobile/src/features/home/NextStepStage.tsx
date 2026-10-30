import { type ShelfEntry } from '@bubo/contracts';
import { type TodayAction } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '../../theme';
import { estimatedMinutes } from '../recall/grades';
import { RecoveryCard } from '../session/RecoveryCard';
import { StageBook, StageButton, StageMessage } from './BookStage';

/**
 * What the book stage shows for Hoje's next action (ADR-032 priority, ADR-043 layout): a saved
 * draft first, then loading/errors, then the current book with one primary action.
 */
export function NextStepStage({
  action,
  entry,
  waitingForNetwork,
  onRetry,
}: {
  action: TodayAction;
  /** The book the action is about (or the current book while reviews are offered). */
  entry: ShelfEntry | null;
  waitingForNetwork: boolean;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const start = (id: string, fiveMinutes: boolean) =>
    router.push({
      pathname: '/sessao/[id]',
      params: { id, ...(fiveMinutes ? { goal: '5' } : {}) },
    });

  if (action.kind === 'recover') return <RecoveryCard draft={action} />;
  if (action.kind === 'loading')
    return waitingForNetwork ? (
      <StageMessage
        title="Sem conexão"
        description="Conecte-se para carregar suas leituras e revisões."
      />
    ) : (
      <View style={{ paddingVertical: theme.spacing.xl }}>
        <ActivityIndicator
          color={theme.colors.onPrimary}
          accessibilityLabel="Carregando seu próximo passo"
        />
      </View>
    );
  if (action.kind === 'retry')
    return (
      <StageMessage
        title="Algo não carregou"
        description={
          action.source === 'draft'
            ? 'Não foi possível recuperar sua sessão neste aparelho.'
            : 'Não foi possível carregar suas leituras e revisões.'
        }
      >
        <View style={{ flexDirection: 'row' }}>
          <StageButton label="Tentar de novo" icon="refresh" onPress={onRetry} />
        </View>
      </StageMessage>
    );
  if (action.kind === 'choose')
    return (
      <StageMessage
        title="Qual vai ser sua próxima leitura?"
        description="Escolha um livro na Estante para começar."
      >
        <View style={{ flexDirection: 'row' }}>
          <StageButton
            label="Escolher um livro"
            icon="menu-book"
            onPress={() => router.navigate('/estante')}
          />
        </View>
      </StageMessage>
    );
  if (action.kind === 'review') {
    if (entry)
      return <StageBook entry={entry} returning={null} onStart={(five) => start(entry.id, five)} />;
    return (
      <StageMessage
        title="Hora de lembrar sem espiar"
        description={`${action.count === 1 ? '1 card disponível' : `${action.count} cards disponíveis`} · ~${estimatedMinutes(action.count)} min`}
      >
        <View style={{ flexDirection: 'row' }}>
          <StageButton
            label="Revisar agora"
            icon="play-arrow"
            onPress={() => router.push('/revisao')}
          />
        </View>
      </StageMessage>
    );
  }
  if (!entry)
    return (
      <View style={{ flexDirection: 'row' }}>
        <StageButton
          label="Continuar leitura"
          icon="play-arrow"
          onPress={() => start(action.shelfEntryId, false)}
        />
      </View>
    );
  return (
    <StageBook
      entry={entry}
      returning={action.kind === 'return' ? action.awayDays : null}
      onStart={(five) => start(action.shelfEntryId, five)}
    />
  );
}
