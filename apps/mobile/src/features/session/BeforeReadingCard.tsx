import { latestReadingReflection, type ReadingReturnSession } from '@bubo/domain';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Text } from '../../design-system';
import { useTheme } from '../../theme';

export function BeforeReadingCard({
  shelfEntryId,
  currentPage,
  sessions,
  historyState,
  busy,
  onStart,
}: {
  shelfEntryId: string;
  currentPage: number;
  sessions: readonly ReadingReturnSession[];
  historyState: 'ready' | 'loading' | 'unavailable';
  busy: boolean;
  onStart: () => void;
}) {
  const theme = useTheme();
  const [question, setQuestion] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const latest = latestReadingReflection(shelfEntryId, sessions);

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <Text variant="titleSm" accessibilityRole="header">
        Antes de voltar
      </Text>
      <Text variant="bodySm" color="accentText">
        {currentPage > 0 ? `Você parou na página ${currentPage}.` : 'Seu livro começa aqui.'}
      </Text>
      {latest ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="bodySm" color="textMuted">
            Sua última anotação · página {latest.endPage}
          </Text>
          {!expanded ? (
            <Text variant="bodySm" numberOfLines={3}>
              {latest.reflection?.trim() ||
                latest.recall?.idea ||
                latest.recall?.detail ||
                latest.recall?.connection}
            </Text>
          ) : latest.reflection?.trim() ? (
            <Text variant="bodySm">{latest.reflection}</Text>
          ) : latest.recall ? (
            <>
              <Text variant="bodySm">Ideia: {latest.recall.idea}</Text>
              <Text variant="bodySm">Detalhe: {latest.recall.detail}</Text>
              <Text variant="bodySm">Ligação ou dúvida: {latest.recall.connection}</Text>
            </>
          ) : null}
          <Button
            label={expanded ? 'Recolher anotação' : 'Ver anotação completa'}
            icon={expanded ? 'expand-less' : 'expand-more'}
            variant="secondary"
            size="md"
            disabled={busy}
            onPress={() => setExpanded((value) => !value)}
          />
        </View>
      ) : (
        <Text variant="bodySm" color="textMuted">
          {historyState === 'loading'
            ? 'Sua última anotação está carregando. Você já pode começar a ler.'
            : historyState === 'unavailable'
              ? 'Não conseguimos buscar sua última anotação agora. Você pode começar a ler normalmente.'
              : 'Sua próxima leitura começa aqui. Quando houver uma anotação, ela aparece neste espaço.'}
        </Text>
      )}
      {question ? (
        <>
          <Text variant="titleSm" accessibilityLiveRegion="polite">
            O que você lembra do trecho anterior?
          </Text>
          <Text variant="bodySm" color="textMuted">
            Se quiser, responda mentalmente sem abrir o livro. Pode começar a ler a qualquer
            momento.
          </Text>
        </>
      ) : (
        <Button
          label="Tentar lembrar"
          icon="psychology"
          variant="secondary"
          size="md"
          disabled={busy}
          accessibilityHint="Mostra uma pergunta opcional para responder mentalmente"
          onPress={() => setQuestion(true)}
        />
      )}
      <Button
        label={question ? 'Pular e começar' : 'Começar agora'}
        icon="play-arrow"
        variant="secondary"
        size="md"
        disabled={busy}
        onPress={onStart}
      />
    </Card>
  );
}
