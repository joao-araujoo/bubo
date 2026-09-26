import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme/tokens';

type Props = {
  step: number;
  total?: number;
  eyebrow: string;
};

export function OnboardingHeader({ step, total = 6, eyebrow }: Props) {
  const progress = Math.max(0, Math.min(1, step / total));

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.step}>{step} de {total}</Text>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginBottom: 18,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  step: {
    color: colors.primary,
    fontFamily: fonts.extraBold,
    fontSize: 12,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
});
