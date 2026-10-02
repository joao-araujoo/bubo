import { toLocalIsoDate } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  InlineMessage,
  Screen,
  Text,
} from '../../design-system';
import { dueLabel, estimatedMinutes } from '../../features/recall/grades';
import { useDueCards } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { useTheme } from '../../theme';

export default function ReviewTab() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const due = useDueCards(auth.status === 'ready' ? auth.userId : undefined);
  const today = toLocalIsoDate(new Date());

  let content: ReactNode;
  if (due.isPending) {
    content = (
      <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando revisões" />
    );
  } else if (due.isError) {
    content = (
      <Card>
        <InlineMessage tone="error" message="Não foi possível carregar suas revisões agora." />
        <Button
          label="Tentar de novo"
          variant="secondary"
          size="md"
          icon="refresh"
          onPress={() => void due.refetch()}
        />
      </Card>
    );
  } else if (due.data.cards.length === 0 && due.data.dueCount > 0) {
    // The reader's daily limit (Preferências) is reached; the rest waits for tomorrow, in order.
    const waiting = due.data.dueCount;
    content = (
      <Card>
        <EmptyState
          mascot="sessionComplete"
          title="Meta de revisões cumprida"
          description={`Você revisou ${due.data.reviewedToday} ${due.data.reviewedToday === 1 ? 'lembrança' : 'lembranças'} hoje, o seu limite diário. ${waiting === 1 ? '1 lembrança volta' : `${waiting} lembranças voltam`} amanhã, na ordem certa.`}
          action={
            <Button
              label="Ajustar limite diário"
              icon="tune"
              variant="secondary"
              fullWidth
              onPress={() => router.push('/configuracoes')}
            />
          }
        />
      </Card>
    );
  } else if (due.data.cards.length > 0) {
    const count = due.data.cards.length;
    const beyond = due.data.dueCount - count;
    content = (
      <View style={{ gap: theme.spacing.lg }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <BuboMascot state="reviewDue" size={80} />
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text variant="bodyStrong">Sua mente guardou essas conexões?</Text>
              <Text variant="bodySm" color="accentText">
                Vamos testar rapidinho!
              </Text>
            </View>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Chip label={`Hoje · ${count}`} tone="primary" icon="event" />
          <Chip label={`~${estimatedMinutes(count)} min`} tone="neutral" icon="schedule" />
        </View>
        {beyond > 0 ? (
          <Text variant="bodySm" color="textMuted">
            {`Seu limite diário é ${due.data.dailyLimit}. ${beyond === 1 ? 'Mais 1 lembrança volta' : `Mais ${beyond} lembranças voltam`} amanhã.`}
          </Text>
        ) : null}
        {due.data.cards.map((card) => (
          <Card key={card.id}>
            <Text variant="caption" color="textMuted">
              {card.bookTitle}
            </Text>
            <Text variant="bodyStrong" numberOfLines={3}>
              {card.prompt}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {card.lastReviewedAt ? 'Hora de retomar esta memória' : 'Primeira revisão'}
            </Text>
            <Button
              label="Ainda lembro?"
              icon="psychology"
              variant="success"
              fullWidth
              onPress={() => router.push('/revisao')}
            />
          </Card>
        ))}
      </View>
    );
  } else if (due.data.totalCards > 0) {
    content = (
      <Card>
        <EmptyState
          mascot="emptyReview"
          title="Tudo revisado por hoje"
          description={
            due.data.nextDueDate
              ? `Sua próxima revisão é ${dueLabel(due.data.nextDueDate, today)}. Voltar no dia certo é o que fixa a memória.`
              : 'Voltar no dia certo é o que fixa a memória.'
          }
        />
      </Card>
    );
  } else {
    content = (
      <Card>
        <EmptyState
          mascot="emptyReview"
          title="Nenhum card ainda"
          description="Ao terminar uma sessão de leitura, escreva o que ficou com você: isso vira um card para lembrar amanhã. Você também pode criar cards na página de cada livro."
          action={
            <Button
              label="Ir para a Estante"
              icon="menu-book"
              fullWidth
              onPress={() => router.navigate('/estante')}
            />
          }
        />
      </Card>
    );
  }

  return (
    <Screen
      header={
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="heading" accessibilityRole="header">
            Hora de lembrar
          </Text>
          <Text variant="bodySm" color="accentText">
            O Bubo preparou suas revisões
          </Text>
        </View>
      }
    >
      {content}
      {due.data && due.data.totalCards > 0 ? (
        <Text variant="bodySm" color="textMuted" align="center">
          {due.data.totalCards === 1 ? '1 card no total' : `${due.data.totalCards} cards no total`}
        </Text>
      ) : null}
    </Screen>
  );
}
