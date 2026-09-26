import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BuboScreen } from '../../src/components/layout/BuboScreen';
import { OnboardingHeader } from '../../src/components/layout/OnboardingHeader';
import { BuboButton } from '../../src/components/ui/BuboButton';
import { BuboCard } from '../../src/components/ui/BuboCard';
import { BuboMascot } from '../../src/components/ui/BuboMascot';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { colors, fonts, spacing, typography } from '../../src/theme/tokens';

export default function CompleteScreen() {
  const { firstBookId, firstBookSkipped } = useOnboarding();

  return (
    <BuboScreen contentStyle={styles.content}>
      <OnboardingHeader step={6} eyebrow="Pronto!" />
      <View style={styles.hero}>
        <BuboMascot state="celebrateConfetti" size={174} />
        <Text style={styles.eyebrow}>ESTANTE CALIBRADA</Text>
        <Text style={styles.title}>Sua estante está pronta! 🎉</Text>
        <Text style={styles.subtitle}>
          O Bubo já pode organizar sua leitura e preparar o gatilho para sua primeira sessão profunda.
        </Text>
      </View>

      {!firstBookSkipped && firstBookId ? (
        <BuboCard style={styles.bookCard}>
          <View>
            <Text style={styles.bookTitle}>{firstBookId === 'dune' ? 'Duna' : 'O Estrangeiro'}</Text>
            <Text style={styles.author}>{firstBookId === 'dune' ? 'Frank Herbert' : 'Albert Camus'}</Text>
          </View>
          <Text style={styles.xp}>⚡ +20 XP</Text>
        </BuboCard>
      ) : (
        <BuboCard style={styles.bookCard}>
          <Text style={styles.bookTitle}>Tudo certo.</Text>
          <Text style={styles.author}>Você pode adicionar seu primeiro livro quando quiser.</Text>
        </BuboCard>
      )}

      <View style={styles.footer}>
        <BuboButton
          label="Ir para o Bubo (Hoje)"
          onPress={() => router.replace('/(tabs)/today')}
        />
      </View>
    </BuboScreen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  hero: { alignItems: 'center', gap: 8 },
  eyebrow: { color: colors.primary, fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 1 },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', maxWidth: 340 },
  bookCard: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  bookTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  author: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  xp: { color: '#A66200', backgroundColor: colors.warningSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontFamily: fonts.extraBold, fontSize: 12 },
  footer: { marginTop: 'auto', paddingTop: spacing.xl },
});
