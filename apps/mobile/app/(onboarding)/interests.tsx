import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BuboScreen } from '../../src/components/layout/BuboScreen';
import { OnboardingHeader } from '../../src/components/layout/OnboardingHeader';
import { BuboButton } from '../../src/components/ui/BuboButton';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { colors, fonts, radii, spacing, typography } from '../../src/theme/tokens';

const genres = [
  ['🚀', 'Ficção Científica'],
  ['🏛️', 'Filosofia'],
  ['🐉', 'Fantasia'],
  ['🧠', 'Psicologia'],
  ['📜', 'História'],
  ['💼', 'Negócios'],
  ['💻', 'Tecnologia'],
  ['👤', 'Biografias'],
  ['🔬', 'Ciência'],
  ['🕵️', 'Suspense & Mistério'],
  ['🌱', 'Autocuidado'],
] as const;

export default function InterestsScreen() {
  const { interests, toggleInterest } = useOnboarding();

  return (
    <BuboScreen>
      <OnboardingHeader step={4} eyebrow="Seu Gosto Literário" />
      <Text style={styles.title}>Quais gêneros você curte?</Text>
      <Text style={styles.subtitle}>
        Vamos calibrar recomendações de clubes e perguntas de inferência para suas leituras favoritas.
      </Text>

      <View style={styles.chips}>
        {genres.map(([icon, label]) => {
          const selected = interests.includes(label);
          return (
            <Pressable
              key={label}
              onPress={() => toggleInterest(label)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && { transform: [{ translateY: 2 }] },
              ]}
            >
              <Text style={styles.chipIcon}>{icon}</Text>
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {interests.length ? (
        <View style={styles.callout}>
          <Text style={styles.calloutText}>
            Você selecionou {interests.length} gêneros. Vamos encontrar leituras e pessoas com gostos em comum!
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <BuboButton
          label="Avançar para Primeiro Livro"
          disabled={!interests.length}
          onPress={() => router.push('/(onboarding)/first-book')}
        />
      </View>
    </BuboScreen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: spacing.xl },
  chip: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    borderBottomColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderBottomColor: colors.primaryPressed,
  },
  chipIcon: { fontSize: 17 },
  chipLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  chipLabelSelected: { color: colors.primaryPressed },
  callout: {
    marginTop: 18,
    padding: 14,
    borderRadius: radii.control,
    backgroundColor: colors.successSoft,
    borderWidth: 2,
    borderColor: '#BFEFD2',
  },
  calloutText: { ...typography.bodySmall, color: '#17663A' },
  footer: { marginTop: spacing.xl },
});
