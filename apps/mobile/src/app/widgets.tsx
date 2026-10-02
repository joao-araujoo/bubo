import { buildWidgetSnapshot } from '@bubo/domain';
import { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import {
  BookCover,
  BuboTip,
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
  MoodTimeline,
  ReadingWidgetPreview,
  StreakWidgetPreview,
  WeekWidgetPreview,
} from '../features/widgets/WidgetPreview';
import { useDueCards, useShelf, useStats } from '../lib/api/queries';
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
    <FormScreen title="Bubo na sua tela" eyebrow="Widgets">
      <BuboTip pose="welcome" title="Sua sequência sempre à vista">
        <Text variant="bodySm">
          O Bubo mostra sua sequência, comemora quando você lê e dá um empurrãozinho quando o dia
          está acabando. À noite, ele dorme.
        </Text>
      </BuboTip>
      {!widgetsAvailable ? (
        <InlineMessage
          tone="info"
          message="Você pode conferir as prévias aqui. Para adicionar os widgets à tela do celular, instale uma versão do Bubo com widgets incluídos."
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
          message="Não foi possível atualizar todos os dados. Os widgets só exibem informações recentes. Abra o Bubo quando tiver conexão."
        />
      ) : null}

      <SectionTitle icon="local-fire-department" title="Sequência" />
      <Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <StreakWidgetPreview snapshot={snapshot} now={now} />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="titleSm">Pequeno e direto</Text>
            <Text variant="bodySm" color="textMuted">
              Dias seguidos com leitura ou revisão. A chama acende quando você lê ou revisa hoje.
            </Text>
          </View>
        </View>
        {addButton('streak')}
      </Card>

      <SectionTitle icon="date-range" title="Sequência da semana" />
      <Card>
        <WeekWidgetPreview snapshot={snapshot} now={now} />
        <Text variant="bodySm" color="textMuted">
          Cada dia da semana com leitura ou revisão ganha um check.
        </Text>
        {addButton('rhythm')}
      </Card>

      <SectionTitle icon="calendar-month" title="Calendário de leitura" />
      <Card>
        <CalendarWidgetPreview snapshot={snapshot} now={now} />
        <Text variant="bodySm" color="textMuted">
          Seus dias ativos do mês. Dias seguidos aparecem ligados, e hoje fica marcado.
        </Text>
        {addButton('calendar')}
      </Card>

      <SectionTitle icon="menu-book" title="Continuar leitura" />
      <Card>
        <ReadingWidgetPreview
          snapshot={snapshot}
          now={now}
          cover={current ? <BookCover {...current.book} width={40} /> : undefined}
        />
        <Text variant="bodySm" color="textMuted">
          Seu livro, sua página e um toque para voltar à sessão.
        </Text>
        {addButton('reading')}
      </Card>

      {fresh ? (
        <>
          <SectionTitle icon="schedule" title="O Bubo ao longo do dia" />
          <Card>
            <Text variant="bodySm" color="textMuted">
              Com os seus dados de hoje, o Bubo vai mudar assim:
            </Text>
            <MoodTimeline snapshot={snapshot} />
          </Card>
        </>
      ) : null}

      <SectionTitle icon="tune" title="Preferências" />
      <Card>
        <Toggle
          title="Atualizar meus widgets"
          description="Ao desativar, os dados são removidos dos widgets deste aparelho."
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
        <Text variant="bodySm" color="textMuted">
          Quando você lê nessa quantidade de dias, o Bubo comemora a meta da semana.
        </Text>
        <Toggle
          title="Ocultar título na tela bloqueada"
          description="Na tela bloqueada do iPhone, o widget mostra a página em vez do título do livro. Ativado por padrão."
          value={device.preferences.hideBookOnLockScreen}
          onValueChange={(hideBookOnLockScreen) => device.update({ hideBookOnLockScreen })}
        />
      </Card>
      <Card>
        <Text variant="titleSm">Como adicionar</Text>
        <Text variant="bodySm">
          {Platform.OS === 'ios'
            ? 'Toque e segure a tela inicial → Editar → Adicionar Widget → Bubo. Escolha Sequência, Sequência da semana, Calendário de leitura ou Continuar leitura. Na tela bloqueada, toque e segure → Personalizar → Adicionar Widgets → Bubo.'
            : 'Toque e segure um espaço vazio na tela inicial → Widgets → Bubo. Arraste o modelo escolhido e ajuste o tamanho.'}
        </Text>
        <Text variant="bodySm" color="textMuted">
          Os dados atualizam quando você usa o Bubo. Sem dados recentes, o widget pede para abrir o
          app. Ao sair da conta, as informações são removidas.
        </Text>
      </Card>
    </FormScreen>
  );
}
