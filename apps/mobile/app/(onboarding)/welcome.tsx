import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BuboScreen } from '../../src/components/layout/BuboScreen';
import { OnboardingHeader } from '../../src/components/layout/OnboardingHeader';
import { BuboButton } from '../../src/components/ui/BuboButton';
import { BuboCard } from '../../src/components/ui/BuboCard';
import { BuboMascot } from '../../src/components/ui/BuboMascot';
import { colors, spacing, typography } from '../../src/theme/tokens';

const pillars = [
  ['📖', 'Leitura', 'Sem pressa'],
  ['🧠', 'Recall', 'Sem espiar'],
  ['✨', 'Retenção', 'Para sempre'],
] as const;

export default function WelcomeScreen() {
  return (
    <BuboScreen>
      <OnboardingHeader step={1} eyebrow="Filosofia Bubo" />
      <View style={styles.hero}>
        <BuboMascot state="reading" size={142} />
        <Text style={styles.title}>Leia. Pense. Lembre.</Text>
        <Text style={styles.quote}>
          “O Bubo ajuda você a descobrir o que realmente ficou guardado depois que a última página é fechada.”
        </Text>
      </View>

      <View style={styles.pillars}>
        {pillars.map(([icon, title, caption]) => (
          <BuboCard key={title} style={styles.pillar}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.pillarTitle}>{title}</Text>
            <Text style={styles.pillarCaption}>{caption}</Text>
          </BuboCard>
        ))}
      </View>

      <View style={styles.footer}>
        <BuboButton
          label="Começar Personalização"
          onPress={() => router.push('/(onboarding)/habit')}
        />
      </View>
    </BuboScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 10, marginTop: 2 },
  title: { ...typography.display, color: colors.text, textAlign: 'center' },
  quote: { ...typography.body, color: colors.textMuted, textAlign: 'center', maxWidth: 340 },
  pillars: { flexDirection: 'row', gap: 8, marginTop: spacing.xl },
  pillar: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 18 },
  icon: { fontSize: 22 },
  pillarTitle: { ...typography.label, color: colors.text, marginTop: 5 },
  pillarCaption: { ...typography.metadata, color: colors.textMuted, textAlign: 'center' },
  footer: { marginTop: 'auto', paddingTop: spacing.xl },
});
