import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar, BuboLogo, Chip } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type Props = {
  /** The signed-in reader's name (initials in the avatar). */
  name: string;
  /** `null` until the reader has real activity (never invented). */
  streakDays: number | null;
  xp: number | null;
};

/** Home header: official logo, streak + XP counters and the profile shortcut. */
export function HomeHeader({ name, streakDays, xp }: Props) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View style={{ flex: 1 }}>
        <BuboLogo height={28} />
      </View>
      <Chip
        tone="orange"
        icon="local-fire-department"
        iconColor="orange"
        label={streakDays === null ? '–' : String(streakDays)}
        accessibilityLabel={
          streakDays === null ? 'Sequência: ainda sem dados' : `Sequência de ${streakDays} dias`
        }
      />
      <Chip
        tone="gold"
        icon="star"
        iconColor="goldRim"
        label={xp === null ? '–' : String(xp)}
        accessibilityLabel={xp === null ? 'XP: ainda sem dados' : `${xp} pontos de experiência`}
      />
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
        <Avatar name={name} size={theme.sizes.touchTarget - 4} />
      </Pressable>
    </View>
  );
}
