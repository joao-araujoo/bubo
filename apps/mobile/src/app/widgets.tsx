import { buildWidgetSnapshot } from '@bubo/domain';
import { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import {
  BookCover,
  Button,
  Card,
  FormScreen,
  InlineMessage,
  SectionTitle,
  Stepper,
  Text,
  Toggle,
} from '../design-system';
import { requestWidgetPin, widgetsAvailable, type WidgetKind } from '../features/widgets/native';
import {
  CalendarWidgetPreview,
  LeagueWidgetPreview,
  MoodTimeline,
  ReadingWidgetPreview,
  StreakWidgetPreview,
  WeekWidgetPreview,
} from '../features/widgets/WidgetPreview';
import { useDueCards, useLeague, useShelf, useStats } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { useDevicePreferences } from '../lib/device-preferences';
import { useTheme } from '../theme';

/** Real-data previews of the home-screen widgets and installation guidance, reached from Você. */
export default function WidgetsScreen() {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const device = useDevicePreferences();
  const shelf = useShelf(userId);
  const stats = useStats(userId);
  const due = useDueCards(userId);
  const league = useLeague(userId);
  const [notice, setNotice] = useState<string | null>(null);
  const [pinning, setPinning] = useState<WidgetKind | null>(null);
  const now = new Date();
  const snapshot =
    shelf.data && stats.data && due.data
      ? buildWidgetSnapshot({
          now,
          updatedAt: Math.min(shelf.dataUpdatedAt, stats.dataUpdatedAt, due.dataUpdatedAt),
          entries: shelf.data.entries,
          stats: stats.data,
          due: due.data,
          weeklyGoal: device.preferences.widgetWeeklyGoal,
          hideBookOnLockScreen: device.preferences.hideBookOnLockScreen,
          league: league.data ?? null,
        })
      : null;
  const fresh = snapshot !== null && snapshot.expiresAt > now.getTime();
  const current = shelf.data?.entries.find((entry) => entry.status === 'reading');

  async function pin(kind: WidgetKind) {
    if (pinning) return;
    setPinning(kind);
    try {
      const requested = await requestWidgetPin(kind);
      setNotice(
        requested
          ? 'Confirme a adição na janela do Android.'
          : 'Toque e segure um espaço vazio na tela inicial, escolha Widgets e procure Bubo.',
      );
    } catch {
      setNotice('Abra o seletor de widgets da tela inicial e procure Bubo.');
    } finally {
      setPinning(null);
    }
  }

  const addButton = (kind: WidgetKind) =>
    Platform.OS === 'android' && widgetsAvailable ? (
      <Button
        label="Adicionar à tela inicial"
        variant="secondary"
        icon="add"
        disabled={!device.preferences.widgetsEnabled}
        loading={pinning === kind}
        onPress={() => void pin(kind)}
      />
    ) : null;

  return (
    <FormScreen title="Widgets">
      {!widgetsAvailable ? (
        <InlineMessage
          tone="info"
          message="Widgets indisponíveis nesta versão. Você pode ver as prévias abaixo."
        />
      ) : null}
      {notice ? <InlineMessage tone="info" message={notice} /> : null}
      {!snapshot && (shelf.isPending || stats.isPending || due.isPending) ? (
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="Carregando dados dos widgets"
        />
      ) : null}
      {shelf.isError || stats.isError || due.isError ? (
        <InlineMessage
          tone="info"
          message="Não foi possível atualizar os dados. Tente novamente com conexão."
        />
      ) : null}

      <SectionTitle icon="local-fire-department" title="Sequência (compacto)" />
      <Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <StreakWidgetPreview snapshot={snapshot} now={now} />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="titleSm">Dias seguidos</Text>
            <Text variant="bodySm" color="textMuted">
              Leitura e revisão contam para sua sequência.
            </Text>
          </View>
        </View>
        {addButton('streak')}
      </Card>

      <SectionTitle icon="date-range" title="Sequência da semana" />
      <Card>
        <WeekWidgetPreview snapshot={snapshot} now={now} />
        <Text variant="bodySm" color="textMuted">
          Dias protegidos aparecem em azul.
        </Text>
        {addButton('rhythm')}
      </Card>

      <SectionTitle icon="calendar-month" title="Calendário de leitura" />
      <Card>
        <CalendarWidgetPreview snapshot={snapshot} now={now} />
        {addButton('calendar')}
      </Card>

      <SectionTitle icon="menu-book" title="Continuar leitura" />
      <Card>
        <ReadingWidgetPreview
          snapshot={snapshot}
          now={now}
          cover={current ? <BookCover {...current.book} width={62} /> : undefined}
        />
        {addButton('reading')}
      </Card>

      <SectionTitle icon="emoji-events" title="Liga semanal" />
      <Card>
        <LeagueWidgetPreview snapshot={snapshot} now={now} />
        <Text variant="bodySm" color="textMuted">
          Entre amigos que compartilham a leitura.
        </Text>
        {addButton('league')}
      </Card>

      {fresh ? (
        <>
          <SectionTitle icon="schedule" title="O Bubo ao longo do dia" />
          <Card>
            <MoodTimeline snapshot={snapshot} />
          </Card>
        </>
      ) : null}

      <SectionTitle icon="tune" title="Preferências" />
      <Card>
        <Toggle
          title="Atualizar meus widgets"
          description="Desativar remove os dados dos widgets deste aparelho."
          value={device.preferences.widgetsEnabled}
          onValueChange={(widgetsEnabled) => device.update({ widgetsEnabled })}
        />
        <Stepper
          label="Meta semanal de leitura"
          min={1}
          max={7}
          value={String(device.preferences.widgetWeeklyGoal)}
          suffix="dias por semana"
          onChangeText={(text) => {
            const goal = Number(text);
            if (Number.isInteger(goal) && goal >= 1 && goal <= 7)
              device.update({ widgetWeeklyGoal: goal });
          }}
        />
        <Toggle
          title="Ocultar título na tela bloqueada"
          description="No iPhone, mostra só a página do livro na tela bloqueada."
          value={device.preferences.hideBookOnLockScreen}
          onValueChange={(hideBookOnLockScreen) => device.update({ hideBookOnLockScreen })}
        />
      </Card>
      <Card>
        <Text variant="titleSm">Como adicionar</Text>
        <Text variant="bodySm">
          {Platform.OS === 'ios'
            ? 'Toque e segure a tela inicial → Editar → Adicionar Widget → Bubo. Na tela bloqueada: Personalizar → Adicionar Widgets → Bubo.'
            : 'Toque e segure um espaço vazio na tela inicial → Widgets → Bubo. Arraste o modelo escolhido e ajuste o tamanho.'}
        </Text>
        <Text variant="bodySm" color="textMuted">
          Abra o Bubo para atualizar os dados. Sair da conta remove as informações dos widgets.
        </Text>
      </Card>
    </FormScreen>
  );
}
