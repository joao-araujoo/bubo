import { type ReaderPreferences } from '@bubo/contracts';
import {
  ANNUAL_BOOK_GOAL_MAX,
  DAILY_FOCUS_OPTIONS,
  DAILY_REVIEW_LIMIT_MAX,
  DAILY_REVIEW_LIMIT_MIN,
  isValidTimeZone,
} from '@bubo/domain';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  FormScreen,
  Icon,
  IconTile,
  type IconTileTone,
  InlineMessage,
  OptionTiles,
  Stepper,
  TabChip,
  Text,
  Toggle,
} from '../design-system';
import { estimatedMinutes } from '../features/recall/grades';
import { usePreferences, useSavePreferences } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { useDevicePreferences } from '../lib/device-preferences';
import { haptics } from '../lib/haptics';
import { currentPushState, type PushState, registerForPush } from '../lib/notifications';
import { darkColors, lightColors, useTheme, useThemePreference } from '../theme';

const REMINDER_HOURS = [7, 8, 9, 12, 18, 19, 20, 21, 22];

/** The device's IANA zone ("America/Sao_Paulo"); the API needs it to remind at the local hour. */
function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimeZone(zone) ? zone : 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

/** Stitch settings block: icon backplate, title + subtitle, optional trailing badge. */
function Section({
  icon,
  tone = 'primary',
  title,
  subtitle,
  children,
}: {
  icon: Parameters<typeof IconTile>[0]['icon'];
  tone?: IconTileTone;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <IconTile icon={icon} tone={tone} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="titleSm" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySm" color="textMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />
      {children}
    </Card>
  );
}

function FieldLabel({ label, trailing }: { label: string; trailing?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text variant="label">{label}</Text>
      {trailing}
    </View>
  );
}

const PUSH_COPY: Record<
  PushState | 'off',
  { tone: 'success' | 'neutral' | 'warning'; text: string }
> = {
  registered: { tone: 'success', text: 'Notificações ativadas neste aparelho.' },
  off: { tone: 'neutral', text: 'Notificações desativadas neste aparelho.' },
  denied: {
    tone: 'warning',
    text: 'As notificações do Bubo estão bloqueadas nas configurações do aparelho.',
  },
  unavailable: {
    tone: 'neutral',
    text: 'Notificações no celular indisponíveis. Seus avisos continuam na tela Notificações.',
  },
};

/**
 * Stitch "Preferências cognitivas". Every option changes how the Bubo works: the review interval,
 * the cards offered per day, the focus mission, the yearly goal, reminders and pushes. Theme and
 * haptics belong to this device; everything else is saved in the account.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const saved = usePreferences(userId);
  const save = useSavePreferences(userId ?? '');
  const { preference, setPreference } = useThemePreference();
  const device = useDevicePreferences();
  const [draft, setDraft] = useState<ReaderPreferences | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [push, setPush] = useState<PushState | 'off' | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void currentPushState(userId).then((state) => active && setPush(state));
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [userId]);
  // The form starts from what is saved; later refetches never overwrite unsaved changes.
  if (saved.data && draft === null) setDraft(saved.data);

  if (saved.isPending || (saved.data && !draft))
    return (
      <FormScreen title="Preferências">
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando" />
      </FormScreen>
    );
  if (saved.isError || !draft)
    return (
      <FormScreen title="Preferências">
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

  async function enablePush() {
    if (asking) return;
    setAsking(true);
    const state = await registerForPush(userId ?? '');
    setPush(state);
    setAsking(false);
    if (state === 'registered') haptics.success();
  }

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
      title="Preferências"
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

      <Section icon="psychology" title="Revisões">
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
      </Section>

      <Section icon="menu-book" tone="gold" title="Leitura e foco">
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
      </Section>

      <Section icon="palette" tone="blue" title="Aparência e toque" subtitle="Só neste aparelho">
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
        <Toggle
          icon="vibration"
          title="Vibração ao tocar"
          value={device.preferences.haptics}
          onValueChange={(on) => device.update({ haptics: on })}
        />
      </Section>

      <Section
        icon="notifications-active"
        tone="orange"
        title="Notificações"
        subtitle={`Horário de ${zone.replace(/_/g, ' ')}`}
      >
        {push ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <Icon
              name={push === 'registered' ? 'notifications-active' : 'notifications-off'}
              size={20}
              color={push === 'registered' ? 'successText' : 'textMuted'}
            />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {PUSH_COPY[push].text}
            </Text>
          </View>
        ) : null}
        {push === 'off' ? (
          <Button
            label="Ativar notificações"
            icon="notifications"
            variant="secondary"
            size="md"
            loading={asking}
            onPress={() => void enablePush()}
          />
        ) : push === 'denied' ? (
          <Button
            label="Abrir configurações do aparelho"
            icon="settings"
            variant="secondary"
            size="md"
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
        <Toggle
          icon="alarm"
          title="Lembrete de revisão"
          description="Uma vez ao dia, quando houver revisões."
          value={draft.reviewReminder}
          onValueChange={(on) => {
            set({ reviewReminder: on });
            if (on && push === 'off') void enablePush();
          }}
        />
        {draft.reviewReminder ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityRole="radiogroup"
            accessibilityLabel="Horário do lembrete"
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: 2 }}
          >
            {REMINDER_HOURS.map((hour) => (
              <TabChip
                key={hour}
                role="radio"
                label={`${String(hour).padStart(2, '0')}h`}
                selected={draft.reminderHour === hour}
                onPress={() => set({ reminderHour: hour })}
              />
            ))}
          </ScrollView>
        ) : null}
        <Toggle
          icon="forum"
          title="Respostas e ciclos dos clubes"
          description="Respostas aos seus posts e início de ciclos."
          value={draft.notifyCommunity}
          onValueChange={(on) => set({ notifyCommunity: on })}
        />
        <Toggle
          icon="people"
          title="Amigos de leitura"
          description="Pedidos de amizade e confirmações."
          value={draft.notifyFriends}
          onValueChange={(on) => set({ notifyFriends: on })}
        />
        <Text variant="bodySm" color="textMuted">
          Os avisos continuam no app e nunca mostram trechos, notas ou reflexões.
        </Text>
      </Section>

      <Section icon="shield" tone="success" title="Anti-spoiler">
        <Toggle
          title="Proteção automática"
          description="Conteúdos além da sua página ficam cobertos. Sempre ativa nos clubes."
          value
          locked
        />
      </Section>
    </FormScreen>
  );
}
