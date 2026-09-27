import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { BuboMascot, Button, FormScreen, SelectableCard, Text } from '../../design-system';
import { toggle, useOnboarding } from '../../features/onboarding/OnboardingProvider';
import { GOAL_OPTIONS, ONBOARDING_TOTAL_STEPS } from '../../features/onboarding/options';
import { useTheme } from '../../theme';

/** Onboarding 3/6 — Metas pessoais (multi-select). */
export default function GoalsStep() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const count = draft.goals.length;

  return (
    <FormScreen
      step={{ current: 3, total: ONBOARDING_TOTAL_STEPS }}
      footer={
        <Button
          label={
            count === 0
              ? 'Continuar'
              : `Continuar (${count} ${count === 1 ? 'selecionado' : 'selecionados'})`
          }
          icon="arrow-forward"
          fullWidth
          disabled={count === 0}
          accessibilityHint={count === 0 ? 'Escolha pelo menos um objetivo' : undefined}
          onPress={() => router.push('/onboarding/interesses')}
        />
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <BuboMascot animated pose="curious" size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="accentText">
              Metas pessoais
            </Text>
            <Text variant="heading" accessibilityRole="header">
              O que você quer melhorar?
            </Text>
          </View>
        </View>
        <Text variant="body" color="textMuted">
          Escolha quantos objetivos quiser. O Bubo prioriza exercícios compatíveis com seu foco.
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          justifyContent: 'space-between',
        }}
      >
        {GOAL_OPTIONS.map((option) => (
          <SelectableCard
            key={option.id}
            mode="checkbox"
            compact
            icon={option.icon}
            title={option.title}
            description={option.description}
            selected={draft.goals.includes(option.id)}
            onPress={() => update({ goals: toggle(draft.goals, option.id) })}
          />
        ))}
      </View>
    </FormScreen>
  );
}
