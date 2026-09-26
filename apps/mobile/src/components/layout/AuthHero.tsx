import { StyleSheet, Text, View } from 'react-native';
import { BuboMascot } from '../ui/BuboMascot';
import { colors, radii, typography } from '../../theme/tokens';
import type { BuboMascotState } from '../../assets/bubo';

type Props = {
  mascot?: BuboMascotState;
  title: string;
  message: string;
};

export function AuthHero({ mascot = 'happyWave', title, message }: Props) {
  return (
    <View style={styles.row}>
      <BuboMascot state={mascot} size={92} />
      <View style={styles.bubble}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bubble: {
    flex: 1,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 3,
  },
  message: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
});
