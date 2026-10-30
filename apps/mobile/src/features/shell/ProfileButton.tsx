import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar } from '../../design-system';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/**
 * The reader's avatar in the top-right of the tab screens. Since ADR-043 "Você" is reached from
 * here instead of a tab.
 */
export function ProfileButton() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  if (auth.status !== 'ready') return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir seu perfil"
      hitSlop={4}
      onPress={() => {
        haptics.selection();
        router.navigate('/voce');
      }}
      style={{
        minWidth: theme.sizes.touchTarget,
        minHeight: theme.sizes.touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          padding: 2,
          borderRadius: theme.radii.pill,
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.gold,
        }}
      >
        <Avatar name={auth.me.user.name} size={38} />
      </View>
    </Pressable>
  );
}
