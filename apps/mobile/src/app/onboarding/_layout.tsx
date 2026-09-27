import { Stack } from 'expo-router';

import { OnboardingProvider } from '../../features/onboarding/OnboardingProvider';
import { useAuthState } from '../../lib/auth/session';
import { useReducedMotion } from '../../lib/motion';
import { useTheme } from '../../theme';

/** Onboarding steps 2–6 (step 1 is the welcome screen before sign-up). */
export default function OnboardingLayout() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const auth = useAuthState();
  const me = auth.status === 'needs_onboarding' || auth.status === 'ready' ? auth.me : null;
  return (
    <OnboardingProvider me={me}>
      <Stack
        screenOptions={{
          animation: reduced ? 'none' : 'slide_from_right',
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      />
    </OnboardingProvider>
  );
}
