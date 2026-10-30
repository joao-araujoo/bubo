import { useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, View } from 'react-native';

import { Button, Icon, TabChip, Text, Toggle } from '../../design-system';
import {
  PreferencesForm,
  type PreferencesFormContext,
} from '../../features/settings/PreferencesForm';
import { SettingsSection } from '../../features/settings/SettingsSection';
import { haptics } from '../../lib/haptics';
import { currentPushState, type PushState, registerForPush } from '../../lib/notifications';
import { useTheme } from '../../theme';

const REMINDER_HOURS = [7, 8, 9, 12, 18, 19, 20, 21, 22];

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

function Body({ draft, set, zone, userId }: PreferencesFormContext) {
  const theme = useTheme();
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

  async function enablePush() {
    if (asking) return;
    setAsking(true);
    const state = await registerForPush(userId ?? '');
    setPush(state);
    setAsking(false);
    if (state === 'registered') haptics.success();
  }

  return (
    <SettingsSection
      icon="notifications-active"
      tone="orange"
      title="Notificações no celular"
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
    </SettingsSection>
  );
}

/** Push notifications for this account: device state, the daily reminder and the switches. */
export default function NotificationSettingsScreen() {
  return (
    <PreferencesForm title="Notificações no celular">
      {(context) => <Body {...context} />}
    </PreferencesForm>
  );
}
