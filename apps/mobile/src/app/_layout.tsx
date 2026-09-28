import { useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, EmptyState, Screen } from '../design-system';
import { BootScreen } from '../features/shell/BootScreen';
import { useReducedMotion } from '../lib/motion';
import { authClient } from '../lib/auth/client';
import { useAuthState } from '../lib/auth/session';
import { createQueryClient, wireQueryToReactNative } from '../lib/query/client';
import { clearQueryCache, persistOptions } from '../lib/query/persist';
import { ThemeProvider, fontSources, useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
wireQueryToReactNative();

function SessionErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen scroll={false}>
      <EmptyState
        mascot="offline"
        title="Não conseguimos carregar sua conta"
        description="Verifique sua conexão. Suas leituras continuam salvas."
        action={<Button label="Tentar de novo" icon="refresh" fullWidth onPress={onRetry} />}
      />
    </Screen>
  );
}

/**
 * Navigation guards (Expo Router `Stack.Protected`):
 * signed out → (auth) · signed in without onboarding → onboarding · ready → (tabs).
 * `redefinir-senha` stays reachable from the e-mailed deep link in any state.
 */
function RootNavigator() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const auth = useAuthState();
  const queryClient = useQueryClient();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bg).catch(() => undefined);
  }, [theme.colors.bg]);

  useEffect(() => {
    // Fonts are ready and either the real loading view or navigation has committed.
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  const unauthorized = auth.status === 'error' && auth.unauthorized;
  useEffect(() => {
    // The server rejected the stored session: clear it locally and go back to sign-in.
    if (!unauthorized) return;
    authClient
      .signOut()
      .catch(() => undefined)
      .finally(() => void clearQueryCache(queryClient));
  }, [unauthorized, queryClient]);

  if (auth.status === 'loading') return <BootScreen />;
  if (auth.status === 'error' && !auth.unauthorized)
    return <SessionErrorScreen onRetry={auth.retry} />;

  const signedIn = auth.status === 'ready' || auth.status === 'needs_onboarding';
  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          animation: reduced ? 'none' : 'fade',
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={auth.status === 'needs_onboarding'}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={auth.status === 'ready'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="livro/[id]" />
          <Stack.Screen name="adicionar-livro" options={{ presentation: 'modal' }} />
          <Stack.Screen name="revisao" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="excluir-conta" />
          <Stack.Screen name="descobrir" />
          <Stack.Screen name="estatisticas" />
          <Stack.Screen name="conquistas" />
          <Stack.Screen name="bloqueados" />
          <Stack.Screen name="clubes/novo" options={{ presentation: 'modal' }} />
          <Stack.Screen name="clubes/[id]" />
          <Stack.Screen name="novo-debate/[clubId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="debates/[clubId]/[postId]" />
          <Stack.Screen name="diretrizes/[clubId]" />
          <Stack.Screen name="catalogo/[id]" />
          <Stack.Screen
            name="sessao/[id]"
            // Full screen and no swipe-to-dismiss: leaving a running session asks for confirmation.
            options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
          />
          <Stack.Screen
            name="dev/showcase"
            options={{
              headerShown: true,
              title: 'DEV · Design system',
              headerStyle: { backgroundColor: theme.colors.surface },
              headerTintColor: theme.colors.text,
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          {/* Used by the Estante and by onboarding ("primeiro livro"). */}
          <Stack.Screen name="scanner-isbn" options={{ presentation: 'fullScreenModal' }} />
        </Stack.Protected>
        <Stack.Screen name="redefinir-senha" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts(fontSources);

  // Keep the native splash until fonts are ready (falls back to system fonts on error).
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
