import { READING_RETURN_COOLDOWN_DAYS } from '@bubo/domain';

import { Text, Toggle } from '../../design-system';
import {
  PreferencesForm,
  type PreferencesFormContext,
} from '../../features/settings/PreferencesForm';
import { SettingsSection } from '../../features/settings/SettingsSection';
import { useAuthState } from '../../lib/auth/session';

function Body({ draft, set }: PreferencesFormContext) {
  const auth = useAuthState();
  const email = auth.status === 'ready' ? auth.me.user.email : undefined;
  return (
    <>
      <SettingsSection icon="mail-outline" title="E-mails opcionais" subtitle={email}>
        <Toggle
          icon="menu-book"
          title="Lembretes de leitura"
          description={`Um lembrete carinhoso quando você passa uma semana sem ler. No máximo um a cada ${READING_RETURN_COOLDOWN_DAYS} dias.`}
          value={draft.emailReadingReminders}
          onValueChange={(on) => set({ emailReadingReminders: on })}
        />
        <Text variant="bodySm" color="textMuted">
          Cada e-mail opcional traz um link para parar de receber na hora. Não enviamos novidades
          nem propaganda.
        </Text>
      </SettingsSection>

      <SettingsSection
        icon="verified-user"
        tone="success"
        title="E-mails da conta"
        subtitle="Sempre enviados, para proteger sua conta"
      >
        <Toggle
          icon="lock-clock"
          title="Códigos de entrada e de nova senha"
          description="Chegam quando você entra em um aparelho novo ou pede uma senha nova."
          value
          locked
        />
        <Toggle
          icon="shield"
          title="Avisos de segurança"
          description="Boas-vindas, senha alterada e confirmação de exclusão da conta."
          value
          locked
        />
      </SettingsSection>
    </>
  );
}

/** Consent for optional e-mails (ADR-038); account e-mails are explained, not switchable. */
export default function EmailSettingsScreen() {
  return (
    <PreferencesForm title="E-mails do Bubo">{(context) => <Body {...context} />}</PreferencesForm>
  );
}
