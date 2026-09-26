import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BuboScreen } from '../../src/components/layout/BuboScreen';
import { OnboardingHeader } from '../../src/components/layout/OnboardingHeader';
import { BuboButton } from '../../src/components/ui/BuboButton';
import { ChoiceTile } from '../../src/components/ui/ChoiceTile';
import { useOnboarding, type OnboardingGoal } from '../../src/features/onboarding/OnboardingContext';
import { colors, spacing, typography } from '../../src/theme/tokens';

const choices: Array<[OnboardingGoal, string, string, string]> = [
  ['remember_more', 'Lembrar mais', 'Reter ideias centrais', '🧠'],
  ['understand_better', 'Entender melhor', 'Explicar com suas palavras', '💡'],
  ['build_habit', 'Criar hábito', 'Constância e sequência', '🔥'],
  ['read_more', 'Ler mais livros', 'Aumentar volume anual', '📚'],
  ['study_technical_books', 'Livros técnicos', 'Estudo e aplicação', '🛠️'],
  ['reflect_on_stories', 'Refletir histórias', 'Ficção e narrativas', '✨'],
];

export default function GoalsScreen() {
  const { goals, toggleGoal } = useOnboarding();

  return (
    <BuboScreen>
      <OnboardingHeader step={3} eyebrow="Metas Pessoais" />
      <Text style={styles.title}>O que você quer melhorar?</Text>
      <Text style={styles.subtitle}>
        Escolha quantos objetivos quiser. O Bubo prioriza exercícios compatíveis com seu foco.
      </Text>

      <View style={styles.choices}>
        {choices.map(([value, title, description, icon]) => (
          <ChoiceTile
            key={value}
            title={title}
            description={description}
            icon={icon}
            selected={goals.includes(value)}
            onPress={() => toggleGoal(value)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <BuboButton
          label={goals.length ? `Continuar (${goals.length} selecionados)` : 'Selecione pelo menos um objetivo'}
          disabled={!goals.length}
          onPress={() => router.push('/(onboarding)/interests')}
        />
      </View>
    </BuboScreen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 6 },
  choices: { gap: 10, marginTop: spacing.xl },
  footer: { marginTop: spacing.xl },
});
