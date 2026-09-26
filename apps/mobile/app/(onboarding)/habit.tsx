import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BuboScreen } from '../../src/components/layout/BuboScreen';
import { OnboardingHeader } from '../../src/components/layout/OnboardingHeader';
import { BuboButton } from '../../src/components/ui/BuboButton';
import { ChoiceTile } from '../../src/components/ui/ChoiceTile';
import { useOnboarding, type ReadingHabit } from '../../src/features/onboarding/OnboardingContext';
import { colors, spacing, typography } from '../../src/theme/tokens';

const choices: Array<[ReadingHabit, string, string, string]> = [
  ['daily', 'Um pouco todo dia', '15 a 30 minutos diários de imersão', '☀️'],
  ['few_times_week', 'Algumas vezes por semana', 'Sessões mais longas nos fins de semana', '📚'],
  ['when_possible', 'Quando tenho tempo livre', 'Sem rotina fixa, leio por impulso', '🕰️'],
  ['returning_reader', 'Estou voltando a ler agora', 'Quero reconstruir o hábito do zero', '🌱'],
];

export default function HabitScreen() {
  const { readingHabit, setReadingHabit } = useOnboarding();

  return (
    <BuboScreen>
      <OnboardingHeader step={2} eyebrow="Ritmo Atual" />
      <Text style={styles.title}>Como você costuma ler?</Text>
      <Text style={styles.subtitle}>
        Não existe resposta certa. O Bubo adapta os ciclos de revisão espaçada à sua rotina real.
      </Text>

      <View style={styles.choices}>
        {choices.map(([value, title, description, icon]) => (
          <ChoiceTile
            key={value}
            title={title}
            description={description}
            icon={icon}
            selected={readingHabit === value}
            onPress={() => setReadingHabit(value)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <BuboButton
          label="Continuar"
          disabled={!readingHabit}
          onPress={() => router.push('/(onboarding)/goals')}
        />
      </View>
    </BuboScreen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 6 },
  choices: { gap: 10, marginTop: spacing.xl },
  footer: { marginTop: 'auto', paddingTop: spacing.xl },
});
