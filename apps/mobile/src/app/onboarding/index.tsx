import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { BuboMascot, Button, FormScreen, SelectableCard, Text } from '../../design-system';
import { useOnboarding } from '../../features/onboarding/OnboardingProvider';
import { HABIT_OPTIONS, ONBOARDING_TOTAL_STEPS } from '../../features/onboarding/options';
import { useTheme } from '../../theme';

/** Onboarding 2/6 — Ritmo atual (single choice). */
export default function HabitStep() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, update } = useOnboarding();

  return (
    <FormScreen
      back={false}
      step={{ current: 2, total: ONBOARDING_TOTAL_STEPS }}
      footer={
        <Button
          label="Continuar"
          icon="arrow-forward"
          fullWidth
          disabled={draft.readingHabit === null}
          accessibilityHint={
            draft.readingHabit === null ? 'Escolha uma opção para continuar' : undefined
          }
          onPress={() => router.push('/onboarding/objetivo')}
        />
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <BuboMascot animated pose="idea" size={64} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="accentText">
              Ritmo atual
            </Text>
            <Text variant="heading" accessibilityRole="header">
              Como você costuma ler?
            </Text>
          </View>
        </View>
        <Text variant="body" color="textMuted">
          Não existe resposta certa. O Bubo adapta os ciclos de revisão espaçada à sua rotina real.
        </Text>
      </View>
      <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.md }}>
        {HABIT_OPTIONS.map((option) => (
          <SelectableCard
            key={option.id}
            mode="radio"
            icon={option.icon}
            title={option.title}
            description={option.description}
            selected={draft.readingHabit === option.id}
            onPress={() => update({ readingHabit: option.id })}
          />
        ))}
      </View>
    </FormScreen>
  );
}
