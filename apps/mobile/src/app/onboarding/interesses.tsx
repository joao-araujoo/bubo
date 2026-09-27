import { useRouter } from 'expo-router';
import { View } from 'react-native';

import {
  BuboMascot,
  Button,
  FormScreen,
  InlineMessage,
  Text,
  ToggleChip,
} from '../../design-system';
import { toggle, useOnboarding } from '../../features/onboarding/OnboardingProvider';
import { GENRE_OPTIONS, ONBOARDING_TOTAL_STEPS } from '../../features/onboarding/options';
import { useTheme } from '../../theme';

/** Onboarding 4/6 — Gosto literário (multi-select genres). */
export default function InterestsStep() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const count = draft.interests.length;

  return (
    <FormScreen
      step={{ current: 4, total: ONBOARDING_TOTAL_STEPS }}
      footer={
        <Button
          label="Avançar para o primeiro livro"
          icon="arrow-forward"
          fullWidth
          disabled={count === 0}
          accessibilityHint={count === 0 ? 'Escolha pelo menos um gênero' : undefined}
          onPress={() => router.push('/onboarding/primeiro-livro')}
        />
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <BuboMascot animated pose="curious" size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="accentText">
              Seu gosto literário
            </Text>
            <Text variant="heading" accessibilityRole="header">
              Quais gêneros você curte?
            </Text>
          </View>
        </View>
        <Text variant="body" color="textMuted">
          Vamos calibrar as recomendações dos clubes e as perguntas das suas revisões.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {GENRE_OPTIONS.map((option) => (
          <ToggleChip
            key={option.id}
            icon={option.icon}
            label={option.title}
            selected={draft.interests.includes(option.id)}
            onPress={() => update({ interests: toggle(draft.interests, option.id) })}
          />
        ))}
      </View>
      {count > 0 ? (
        <InlineMessage
          tone="info"
          message={`Você selecionou ${count} ${count === 1 ? 'gênero' : 'gêneros'}. Vamos encontrar leitores que compartilham essas paixões.`}
        />
      ) : null}
    </FormScreen>
  );
}
