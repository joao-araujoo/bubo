import { type ReaderPreferences } from '@bubo/contracts';
import { isValidTimeZone } from '@bubo/domain';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button, EmptyState, FormScreen, InlineMessage } from '../../design-system';
import { usePreferences, useSavePreferences } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/** The device's IANA zone ("America/Sao_Paulo"); the API needs it to remind at the local hour. */
export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimeZone(zone) ? zone : 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

export type PreferencesFormContext = {
  draft: ReaderPreferences;
  set: (patch: Partial<ReaderPreferences>) => void;
  zone: string;
  userId: string | undefined;
};

/**
 * Shared shell of the account-preference screens (ADR-022, split by ADR-039): loads the saved
 * preferences once, keeps an editable draft, and saves everything with one explicit "Salvar".
 * Every screen edits a slice of the same object, so nothing is lost between them.
 */
export function PreferencesForm({
  title,
  children,
}: {
  title: string;
  children: (context: PreferencesFormContext) => ReactNode;
}) {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const saved = usePreferences(userId);
  const save = useSavePreferences(userId ?? '');
  const [draft, setDraft] = useState<ReaderPreferences | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The form starts from what is saved; later refetches never overwrite unsaved changes.
  if (saved.data && draft === null) setDraft(saved.data);

  if (saved.isPending || (saved.data && !draft))
    return (
      <FormScreen title={title}>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando" />
      </FormScreen>
    );
  if (saved.isError || !draft)
    return (
      <FormScreen title={title}>
        <EmptyState
          mascot="offline"
          title="Não foi possível carregar suas preferências"
          description="Verifique sua conexão e tente de novo."
          action={
            <Button label="Tentar de novo" icon="refresh" onPress={() => void saved.refetch()} />
          }
        />
      </FormScreen>
    );

  const zone = deviceTimeZone();
  const form: ReaderPreferences = { ...draft, timeZone: zone };
  // Also true when only the device zone changed (travel): saving keeps reminders on local time.
  const dirty = JSON.stringify(form) !== JSON.stringify(saved.data);
  const set = (patch: Partial<ReaderPreferences>) => {
    setNotice(null);
    setDraft({ ...draft, ...patch });
  };
  function submit() {
    if (save.isPending) return;
    save.mutate(form, {
      onSuccess: (next) => {
        haptics.success();
        setDraft(next);
        setNotice('Preferências salvas.');
      },
      onError: () => haptics.error(),
    });
  }

  return (
    <FormScreen
      title={title}
      footer={
        <>
          {save.isError ? (
            <InlineMessage tone="error" message="Não foi possível salvar. Tente de novo." />
          ) : null}
          <Button
            label={dirty ? 'Salvar' : 'Tudo salvo'}
            icon={dirty ? 'save' : 'check'}
            fullWidth
            disabled={!dirty}
            loading={save.isPending}
            onPress={submit}
          />
        </>
      }
    >
      {notice ? <InlineMessage tone="success" message={notice} /> : null}
      {children({ draft, set, zone, userId })}
    </FormScreen>
  );
}
