import { View } from 'react-native';

import { BuboLogo, Text } from '../../design-system';
import { MascotGreeting } from '../../lib/motion';
import { useTheme } from '../../theme';

/** Only mounted during real session loading. No timer or synthetic percentage. */
export function BootScreen() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.xl,
      }}
    >
      <MascotGreeting>
        <BuboLogo variant="symbol" height={160} />
      </MascotGreeting>
      <View
        style={{ gap: theme.spacing.sm }}
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy: true }}
      >
        <Text variant="title" align="center">
          Preparando seu Bubo
        </Text>
        <Text color="textMuted" align="center">
          Carregando sua conta com cuidado.
        </Text>
      </View>
    </View>
  );
}
