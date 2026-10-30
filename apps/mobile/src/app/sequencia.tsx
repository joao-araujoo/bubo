import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '../design-system';
import { SceneButton, SceneTextButton, useLightStatusBar } from '../features/session/scene';
import { StreakNight } from '../features/session/StreakNight';
import { useAchievements, useStats } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { readingPalette, useTheme } from '../theme';

/** "Dias seguidos" (ADR-044): from Hoje's streak tile, and after a session that grew the streak. */
export default function StreakScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { depois } = useLocalSearchParams<{ depois?: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const stats = useStats(userId);
  const achievements = useAchievements(userId);
  useLightStatusBar();

  function close() {
    if (depois === 'leitura') router.dismissTo('/');
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  if (!stats.data) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.md,
          padding: theme.sizes.gutter,
          backgroundColor: readingPalette.night,
        }}
      >
        {stats.isError ? (
          <>
            <Text variant="bodyStrong" align="center" style={{ color: readingPalette.nightText }}>
              Não foi possível carregar sua sequência agora.
            </Text>
            <SceneButton
              variant="gold"
              label="Tentar novamente"
              style={{ alignSelf: 'stretch' }}
              onPress={() => void stats.refetch()}
            />
            <SceneTextButton label="Fechar" color={readingPalette.nightMuted} onPress={close} />
          </>
        ) : (
          <ActivityIndicator
            color={readingPalette.gold}
            accessibilityLabel="Carregando sequência"
          />
        )}
      </View>
    );
  }

  return <StreakNight stats={stats.data} achievements={achievements.data} onClose={close} />;
}
