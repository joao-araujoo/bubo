import { Stack } from 'expo-router';

import { useReducedMotion } from '../../lib/motion';
import { useTheme } from '../../theme';

export const unstable_settings = { initialRouteName: 'boas-vindas' };

export default function AuthLayout() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        animation: reduced ? 'none' : 'slide_from_right',
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    />
  );
}
