import {
  ANNUAL_BOOK_GOAL_MAX,
  DAILY_FOCUS_OPTIONS,
  DAILY_REVIEW_LIMIT_MAX,
  DAILY_REVIEW_LIMIT_MIN,
} from '@bubo/domain';
import { View } from 'react-native';

import { Icon, OptionTiles, Stepper, Text, Toggle } from '../../design-system';
import { estimatedMinutes } from '../../features/recall/grades';
import {
  PreferencesForm,
  type PreferencesFormContext,
} from '../../features/settings/PreferencesForm';
import { FieldLabel, SettingsSection } from '../../features/settings/SettingsSection';
import { useTheme } from '../../theme';

function Body({ draft, set }: PreferencesFormContext) {
  const theme = useTheme();
  return (
    <>
      <SettingsSection icon="psychology" title="Revisões">
        <FieldLabel
          label="Ritmo das revisões"
          trailing={
            draft.reviewIntensity === 'balanced' ? (
              <Text variant="label" color="accentText">
                Recomendado
              </Text>
            ) : undefined
          }
        />
        <OptionTiles
          accessibilityLabel="Ritmo das revisões"
          value={draft.reviewIntensity}
          onChange={(reviewIntensity) => set({ reviewIntensity })}
          options={[
            { value: 'gentle', label: 'Suave', caption: 'Mais espaçadas' },
            { value: 'balanced', label: 'Equilibrado', caption: 'Padrão' },
            { value: 'intensive', label: 'Intensivo', caption: 'Mais frequentes' },
          ]}
        />
        <Stepper
          label="Revisões por dia"
          value={String(draft.dailyReviewLimit)}
          onChangeText={(text) => {
            const value = Number(text);
            if (Number.isInteger(value))
              set({
                dailyReviewLimit: Math.min(
                  DAILY_REVIEW_LIMIT_MAX,
                  Math.max(DAILY_REVIEW_LIMIT_MIN, value),
                ),
              });
          }}
          min={DAILY_REVIEW_LIMIT_MIN}
          max={DAILY_REVIEW_LIMIT_MAX}
          step={5}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Icon name="schedule" size={16} color="textMuted" />
          <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
            {`~${estimatedMinutes(draft.dailyReviewLimit)} min por dia. Cards acima do limite ficam para amanhã.`}
          </Text>
        </View>
      </SettingsSection>

      <SettingsSection icon="menu-book" tone="gold" title="Leitura e foco">
        <FieldLabel label="Meta diária de foco" />
        <OptionTiles
          accessibilityLabel="Meta diária de foco"
          value={draft.dailyFocusMinutes}
          onChange={(dailyFocusMinutes) => set({ dailyFocusMinutes })}
          options={DAILY_FOCUS_OPTIONS.map((minutes) => ({
            value: minutes,
            label: `${minutes} min`,
          }))}
        />
        <Toggle
          icon="flag"
          title="Meta anual de livros"
          value={draft.annualBookGoal !== null}
          onValueChange={(on) => set({ annualBookGoal: on ? 12 : null })}
        />
        {draft.annualBookGoal !== null ? (
          <Stepper
            label="Livros em um ano"
            value={String(draft.annualBookGoal)}
            onChangeText={(text) => {
              const value = Number(text);
              if (Number.isInteger(value))
                set({ annualBookGoal: Math.min(ANNUAL_BOOK_GOAL_MAX, Math.max(1, value)) });
            }}
            min={1}
            max={ANNUAL_BOOK_GOAL_MAX}
          />
        ) : null}
      </SettingsSection>
    </>
  );
}

/** Account preferences that change how the Bubo works: review rhythm, focus and the yearly goal. */
export default function ReadingSettingsScreen() {
  return (
    <PreferencesForm title="Revisões e leitura">
      {(context) => <Body {...context} />}
    </PreferencesForm>
  );
}
