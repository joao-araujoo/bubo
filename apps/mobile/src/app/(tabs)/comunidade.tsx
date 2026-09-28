import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  EmptyState,
  InlineMessage,
  Screen,
  SectionHeader,
  Text,
  TextField,
} from '../../design-system';
import { useDebouncedValue } from '../../features/catalog/catalog';
import { ClubCard } from '../../features/community/ClubCard';
import { useClubs } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { useTheme } from '../../theme';

/** Comunidade: my clubs, public clubs to discover and search (Task 07). */
export default function CommunityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim());
  const clubs = useClubs(auth.status === 'ready' ? auth.userId : undefined, q);
  const searching = q.length > 0;
  const create = () => router.push('/clubes/novo');

  return (
    <Screen
      header={
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="heading" accessibilityRole="header">
            Comunidade
          </Text>
          <Text variant="bodySm" color="accentText">
            Leia junto, sem spoilers
          </Text>
        </View>
      }
    >
      <TextField
        label="Buscar clubes"
        hideLabel
        icon="search"
        placeholder="Buscar por clube ou livro"
        value={text}
        onChangeText={setText}
        returnKeyType="search"
        autoCorrect={false}
      />

      {clubs.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando clubes" />
      ) : clubs.isError ? (
        <Card>
          <InlineMessage tone="error" message="Não foi possível carregar os clubes agora." />
          <Button
            label="Tentar de novo"
            variant="secondary"
            size="md"
            icon="refresh"
            onPress={() => void clubs.refetch()}
          />
        </Card>
      ) : (
        <>
          {!searching && clubs.data.mine.length === 0 ? (
            <Card tone="muted">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <BuboMascot state="emptyCommunity" size={80} />
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text variant="bodyStrong">Clubes sem spoiler</Text>
                  <Text variant="bodySm" color="textMuted">
                    Cada debate diz a página de que fala. O que estiver à frente da sua leitura fica
                    escondido até você chegar lá.
                  </Text>
                </View>
              </View>
              <Button label="Criar um clube" icon="add" size="md" fullWidth onPress={create} />
            </Card>
          ) : null}

          {clubs.data.mine.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <SectionHeader
                title="Meus clubes"
                icon="groups"
                trailing={
                  searching ? undefined : (
                    <Button
                      label="Criar"
                      icon="add"
                      variant="secondary"
                      size="md"
                      compact
                      onPress={create}
                    />
                  )
                }
              />
              {clubs.data.mine.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </View>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <SectionHeader title={searching ? 'Resultados' : 'Descobrir clubes'} icon="explore" />
            {clubs.data.discover.length === 0 ? (
              <EmptyState
                compact
                mascot={searching ? 'notFound' : 'emptyCommunity'}
                title={searching ? 'Nenhum clube encontrado' : 'Nenhum outro clube ainda'}
                description={
                  searching
                    ? 'Tente o nome do livro ou crie um clube para ele.'
                    : 'A comunidade está começando. Que tal abrir o primeiro clube do seu livro?'
                }
              />
            ) : (
              clubs.data.discover.map((club) => <ClubCard key={club.id} club={club} />)
            )}
          </View>
        </>
      )}
    </Screen>
  );
}
