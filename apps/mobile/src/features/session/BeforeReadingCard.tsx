import { latestReadingReflection, type ReadingReturnSession } from '@bubo/domain';
import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '../../design-system';
import { readingPalette, useTheme } from '../../theme';
import { SceneTextButton } from './scene';

/**
 * "Antes de voltar", on the night of the timer (ADR-032, restyled by ADR-044): where the reader
 * stopped, the latest real note of this book and an optional question answered mentally. Starting
 * is the timer's own primary button.
 */
export function BeforeReadingCard({
  shelfEntryId,
  currentPage,
  sessions,
  historyState,
  busy,
}: {
  shelfEntryId: string;
  currentPage: number;
  sessions: readonly ReadingReturnSession[];
  historyState: 'ready' | 'loading' | 'unavailable';
  busy: boolean;
}) {
  const theme = useTheme();
  const [question, setQuestion] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const latest = latestReadingReflection(shelfEntryId, sessions);
  const ink = { color: readingPalette.nightText };
  const muted = { color: readingPalette.nightMuted };

  return (
    <View
      style={{
        gap: theme.spacing.xs,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.card,
        borderWidth: 1.5,
        borderColor: readingPalette.glassBorder,
        backgroundColor: readingPalette.glass,
      }}
    >
      <Text variant="titleSm" accessibilityRole="header" style={ink}>
        Antes de voltar
      </Text>
      <Text variant="bodySm" style={{ color: readingPalette.gold }}>
        {currentPage > 0 ? `Você parou na página ${currentPage}.` : 'Seu livro começa aqui.'}
      </Text>
      {latest ? (
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="bodySm" style={muted}>
            Sua última anotação · página {latest.endPage}
          </Text>
          {!expanded ? (
            <Text variant="bodySm" numberOfLines={3} style={ink}>
              {latest.reflection?.trim() ||
                latest.recall?.idea ||
                latest.recall?.detail ||
                latest.recall?.connection}
            </Text>
          ) : latest.reflection?.trim() ? (
            <Text variant="bodySm" style={ink}>
              {latest.reflection}
            </Text>
          ) : latest.recall ? (
            <>
              <Text variant="bodySm" style={ink}>
                Ideia: {latest.recall.idea}
              </Text>
              <Text variant="bodySm" style={ink}>
                Detalhe: {latest.recall.detail}
              </Text>
              <Text variant="bodySm" style={ink}>
                Ligação ou dúvida: {latest.recall.connection}
              </Text>
            </>
          ) : null}
          <SceneTextButton
            label={expanded ? 'Recolher anotação' : 'Ver anotação completa'}
            icon={expanded ? 'expand-less' : 'expand-more'}
            disabled={busy}
            onPress={() => setExpanded((value) => !value)}
          />
        </View>
      ) : (
        <Text variant="bodySm" style={muted}>
          {historyState === 'loading'
            ? 'Sua última anotação está carregando. Você já pode começar a ler.'
            : historyState === 'unavailable'
              ? 'Não conseguimos buscar sua última anotação agora. Você pode começar a ler normalmente.'
              : 'Sua próxima leitura começa aqui. Quando houver uma anotação, ela aparece neste espaço.'}
        </Text>
      )}
      {question ? (
        <View style={{ gap: theme.spacing.xxs, paddingTop: theme.spacing.xs }}>
          <Text variant="titleSm" accessibilityLiveRegion="polite" style={ink}>
            O que você lembra do trecho anterior?
          </Text>
          <Text variant="bodySm" style={muted}>
            Se quiser, responda mentalmente sem abrir o livro. Pode começar a ler a qualquer
            momento.
          </Text>
        </View>
      ) : (
        <SceneTextButton
          label="Tentar lembrar antes"
          icon="psychology"
          disabled={busy}
          accessibilityHint="Mostra uma pergunta opcional para responder mentalmente"
          onPress={() => setQuestion(true)}
        />
      )}
    </View>
  );
}
