import { View } from 'react-native';

import { useIsOffline } from '../lib/network';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** Announced, non-blocking banner shown only while the device is offline. */
export function OfflineBanner() {
  const theme = useTheme();
  const offline = useIsOffline();
  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginHorizontal: theme.sizes.gutter,
        marginBottom: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.orangeSoft,
      }}
    >
      <Icon name="cloud-off" size={18} color="text" />
      <Text variant="bodySm" style={{ flex: 1 }}>
        Você está offline. Mostramos o que já está no aparelho e sincronizamos quando a conexão
        voltar.
      </Text>
    </View>
  );
}
