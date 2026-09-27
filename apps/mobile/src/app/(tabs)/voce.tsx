import { type MeResponse } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Avatar, Button, Card, LinkButton, Screen, Text } from '../../design-system';
import { GENRE_OPTIONS, GOAL_OPTIONS, HABIT_OPTIONS } from '../../features/onboarding/options';
import { useShelf, useStats } from '../../lib/api/queries';
import { useAuthState, useSignOut } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { type ThemePreference, useTheme, useThemePreference } from '../../theme';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

function AppearancePicker() {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();
  return (
    <Card>
      <Text variant="caption" color="textMuted" accessibilityRole="header">
        Aparência
      </Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {OPTIONS.map((option) => {
          const selected = option.value === preference;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Tema ${option.label}`}
              onPress={() => {
                haptics.selection();
                setPreference(option.value);
              }}
              style={{
                flex: 1,
                minHeight: theme.sizes.touchTarget,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.pill,
                borderWidth: theme.sizes.borderWidth,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
              }}
            >
              <Text variant="label" color={selected ? 'accentText' : 'text'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function ProfileCard({
  me,
  booksRead,
  xp,
  streak,
}: {
  me: MeResponse;
  booksRead: number | null;
  xp: number | null;
  streak: number | null;
}) {
  const theme = useTheme();
  const habit = HABIT_OPTIONS.find((o) => o.id === me.profile.readingHabit);
  const goals = GOAL_OPTIONS.filter((o) => me.profile.goals.includes(o.id)).map((o) => o.title);
  const genres = GENRE_OPTIONS.filter((o) => me.profile.interests.includes(o.id)).map(
    (o) => o.title,
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Avatar name={me.user.name} size={72} />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>
            {me.user.name}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {me.user.email}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {[
          { label: 'Lidos na estante', value: booksRead },
          { label: 'XP', value: xp },
          { label: 'Dias de sequência', value: streak },
        ].map((item) => (
          <View
            key={item.label}
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
              {item.value === null ? '—' : item.value}
            </Text>
            <Text variant="bodySm" color="textMuted" align="center">
              {item.label}
            </Text>
          </View>
        ))}
      </View>
      {habit ? <ProfileLine label="Ritmo" value={habit.title} /> : null}
      {goals.length > 0 ? <ProfileLine label="Objetivos" value={goals.join(', ')} /> : null}
      {genres.length > 0 ? <ProfileLine label="Gêneros" value={genres.join(', ')} /> : null}
    </Card>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

export default function YouScreen() {
  const router = useRouter();
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const shelf = useShelf(userId);
  const stats = useStats(userId);
  const signOut = useSignOut();
  const [signingOut, setSigningOut] = useState(false);

  const confirmSignOut = () =>
    Alert.alert('Sair da conta?', 'Você pode entrar de novo quando quiser.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          signOut().finally(() => setSigningOut(false));
        },
      },
    ]);

  return (
    <Screen
      header={
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="heading" accessibilityRole="header">
            Meu Perfil
          </Text>
          <Text variant="bodySm" color="textMuted">
            Sua jornada de leitura
          </Text>
        </View>
      }
    >
      {auth.status === 'ready' ? (
        <ProfileCard
          me={auth.me}
          booksRead={
            shelf.data
              ? shelf.data.entries.filter((entry) => entry.status === 'finished').length
              : null
          }
          xp={stats.data?.xpTotal ?? null}
          streak={stats.data?.streakDays ?? null}
        />
      ) : null}
      <AppearancePicker />
      <Button
        label="Minha memória"
        variant="secondary"
        onPress={() => router.push('/estatisticas')}
      />
      <Button
        label="Sair da conta"
        variant="secondary"
        size="md"
        icon="logout"
        loading={signingOut}
        onPress={confirmSignOut}
      />
      <LinkButton
        label="Excluir conta"
        color="error"
        accessibilityHint="Abre a tela para excluir sua conta e seus dados"
        onPress={() => router.push('/excluir-conta')}
      />
      {__DEV__ ? (
        <Button
          label="DEV · Design system"
          variant="secondary"
          size="md"
          icon="palette"
          accessibilityHint="Abre a vitrine de componentes (apenas em desenvolvimento)"
          onPress={() => router.push('/dev/showcase')}
        />
      ) : null}
    </Screen>
  );
}
