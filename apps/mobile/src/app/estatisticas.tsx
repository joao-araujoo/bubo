import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Button, Card, EmptyState, Screen, Text } from '../design-system';
import { useMemoryStats } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { useTheme } from '../theme';

export default function MemoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const auth = useAuthState();
  const stats = useMemoryStats(auth.status === 'ready' ? auth.userId : undefined);
  const days = stats.data?.days ?? [];
  const total = days.reduce((sum, day) => sum + day.remembered + day.almost + day.forgot, 0);
  return (
    <Screen
      header={
        <View style={{ gap: theme.spacing.sm }}>
          <Button label="Voltar" variant="secondary" size="md" onPress={() => router.back()} />
          <Text variant="heading" accessibilityRole="header">
            Minha memória
          </Text>
          <Text color="textMuted">Suas revisões nos últimos 7 dias</Text>
        </View>
      }
    >
      {stats.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando revisões" />
      ) : stats.isError ? (
        <EmptyState
          mascot="offline"
          title="Não conseguimos carregar suas revisões"
          description="Verifique sua conexão e tente novamente."
          action={<Button label="Tentar novamente" onPress={() => void stats.refetch()} />}
        />
      ) : total === 0 ? (
        <EmptyState
          mascot="emptyReview"
          title="Seu histórico começa com uma revisão"
          description="Nenhuma revisão registrada nos últimos 7 dias. Quando você revisar um cartão, sua avaliação aparece aqui."
          action={<Button label="Ir para Revisar" onPress={() => router.push('/(tabs)/revisar')} />}
        />
      ) : (
        <>
          <Card>
            <Text variant="title">
              {total} {total === 1 ? 'revisão registrada' : 'revisões registradas'}
            </Text>
            <Text color="textMuted">
              Lembrei, Quase e Esqueci mostram como você avaliou cada tentativa. Não são uma medida
              de retenção.
            </Text>
          </Card>
          {days.map((day) => (
            <Card key={day.date}>
              <Text variant="titleSm" accessibilityRole="header">
                {day.date.split('-').reverse().join('/')}
              </Text>
              <Text>
                Lembrei: {day.remembered} · Quase: {day.almost} · Esqueci: {day.forgot}
              </Text>
            </Card>
          ))}
          <Button label="Ir para Revisar" onPress={() => router.push('/(tabs)/revisar')} />
        </>
      )}
    </Screen>
  );
}
