import { FormScreen, OptionTiles, Text, Toggle } from '../../design-system';
import { FieldLabel, SettingsSection } from '../../features/settings/SettingsSection';
import { useDevicePreferences } from '../../lib/device-preferences';
import { darkColors, lightColors, useThemePreference } from '../../theme';

/** Choices that belong to this device, not the account (ADR-022): applied immediately. */
export default function DeviceSettingsScreen() {
  const { preference, setPreference } = useThemePreference();
  const device = useDevicePreferences();
  return (
    <FormScreen title="Aparência e toque">
      <SettingsSection icon="palette" tone="blue" title="Aparência" subtitle="Só neste aparelho">
        <FieldLabel label="Tema" />
        <OptionTiles
          accessibilityLabel="Tema"
          value={preference}
          onChange={setPreference}
          options={[
            {
              value: 'light',
              label: 'Claro',
              swatch: { fill: lightColors.surface, border: lightColors.border },
            },
            {
              value: 'dark',
              label: 'Escuro',
              swatch: { fill: darkColors.bg, border: darkColors.border },
            },
            {
              value: 'system',
              label: 'Sistema',
              swatch: { fill: lightColors.primarySoft, border: lightColors.primary },
            },
          ]}
        />
      </SettingsSection>
      <SettingsSection icon="vibration" tone="gold" title="Toque">
        <Toggle
          icon="vibration"
          title="Vibração ao tocar"
          description="Resposta tátil nos botões e nas conquistas."
          value={device.preferences.haptics}
          onValueChange={(on) => device.update({ haptics: on })}
        />
      </SettingsSection>
      <Text variant="bodySm" color="textMuted" align="center">
        Essas escolhas são salvas na hora e ficam só neste aparelho.
      </Text>
    </FormScreen>
  );
}
