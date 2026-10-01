import { type GlobalModerationRequest, type ModerationQueue } from '@bubo/contracts';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import {
  BuboTip,
  Button,
  Card,
  EmptyState,
  FormScreen,
  HeaderButton,
  InlineMessage,
  Pill,
  type PillTone,
  StatTile,
  Text,
  Toggle,
} from '../design-system';
import { REPORT_REASONS } from '../features/community/meta';
import { useGlobalModeration, useModerationQueue } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

type Item = ModerationQueue['items'][number];

const TARGET_META: Record<Item['targetType'], { label: string; tone: PillTone }> = {
  post: { label: 'Debate ou resenha', tone: 'primary' },
  reply: { label: 'Resposta', tone: 'blue' },
  poll: { label: 'Enquete', tone: 'orange' },
  argument: { label: 'Argumento de voto', tone: 'gold' },
};

const reasonLabel = (reason: string) =>
  REPORT_REASONS.find((option) => option.value === reason)?.label ?? reason;

/**
 * Bubo-wide moderation (Task 08), only for the account ids configured on the server
 * (`MODERATOR_USER_IDS`). Reported texts stay hidden until the moderator chooses to reveal them;
 * decisions resolve every open report of the item.
 */
export default function ModerationScreen() {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' && auth.me.isModerator ? auth.userId : undefined;
  const [reveal, setReveal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const queue = useModerationQueue(userId, reveal);
  const moderate = useGlobalModeration(userId ?? '');

  if (!userId)
    return (
      <FormScreen align="left" eyebrow="Comunidade" title="Moderação">
        <EmptyState
          mascot="notFound"
          title="Acesso restrito"
          description="Esta área é exclusiva das contas de moderação configuradas pelo proprietário do Bubo."
        />
      </FormScreen>
    );

  const decide = (item: Item, action: GlobalModerationRequest['action']) =>
    Alert.alert(
      action === 'remove' ? 'Remover este conteúdo?' : 'Manter este conteúdo?',
      action === 'remove'
        ? 'Ele some para todos e as denúncias abertas são resolvidas.'
        : 'Ele volta a aparecer (se estava oculto) e as denúncias abertas são resolvidas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: action === 'remove' ? 'Remover' : 'Manter',
          style: action === 'remove' ? 'destructive' : 'default',
          onPress: () =>
            moderate.mutate(
              {
                clubId: item.clubId,
                targetType: item.targetType,
                targetId: item.targetId,
                action,
              },
              {
                onSuccess: () => {
                  haptics.success();
                  setNotice(action === 'remove' ? 'Conteúdo removido.' : 'Conteúdo mantido.');
                },
                onError: () => haptics.error(),
              },
            ),
        },
      ],
    );

  const askReveal = (next: boolean) => {
    if (!next) {
      setReveal(false);
      return;
    }
    Alert.alert('Mostrar textos denunciados?', 'Eles podem ter spoilers ou conteúdo ofensivo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Mostrar', onPress: () => setReveal(true) },
    ]);
  };

  const items = queue.data?.items ?? [];
  const totalReports = items.reduce((sum, item) => sum + item.reportCount, 0);

  return (
    <FormScreen
      align="left"
      eyebrow="Comunidade"
      eyebrowDot
      title="Moderação geral"
      headerRight={
        <HeaderButton
          icon="refresh"
          label="Atualizar fila"
          shape="square"
          iconColor="accentText"
          onPress={() => void queue.refetch()}
        />
      }
    >
      <BuboTip pose="review" title="Guardião dos clubes" titleIcon="shield">
        <Text variant="bodySm">
          Só aparece aqui o que leitores denunciaram, das denúncias mais antigas às mais recentes.
          Reflexões e sessões nunca entram nesta fila.
        </Text>
      </BuboTip>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Itens"
            value={queue.data ? String(items.length) : '—'}
            icon="flag"
            tone="error"
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Denúncias"
            value={queue.data ? String(totalReports) : '—'}
            icon="report-gmailerrorred"
            tone="orange"
          />
        </View>
      </View>

      <Card>
        <Toggle
          icon="visibility"
          title="Mostrar textos denunciados"
          description="Necessário para decidir. Os textos são carregados só enquanto esta opção estiver ligada."
          value={reveal}
          onValueChange={askReveal}
        />
      </Card>

      {notice ? <InlineMessage tone="success" message={notice} /> : null}
      {moderate.isError ? (
        <InlineMessage
          tone="error"
          message="Não foi possível concluir. A denúncia pode já ter sido resolvida; atualize a fila."
        />
      ) : null}

      {queue.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando denúncias" />
      ) : queue.isError ? (
        <>
          <InlineMessage
            tone="error"
            message="Não foi possível carregar a fila. Confira sua conexão e seu acesso."
          />
          <Button label="Tentar de novo" icon="refresh" onPress={() => void queue.refetch()} />
        </>
      ) : items.length === 0 ? (
        <EmptyState
          mascot="emptyCommunity"
          title="Nenhuma denúncia aberta"
          description="Os clubes estão tranquilos. Novas denúncias aparecem aqui."
        />
      ) : (
        items.map((item) => (
          <Card key={`${item.targetType}:${item.targetId}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text variant="titleSm" numberOfLines={1} style={{ flex: 1 }}>
                {item.clubName}
              </Text>
              <Pill
                tone="error"
                icon="flag"
                label={item.reportCount === 1 ? '1 denúncia' : `${item.reportCount} denúncias`}
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              <Pill
                tone={TARGET_META[item.targetType].tone}
                label={TARGET_META[item.targetType].label}
              />
              {item.reasons.map((reason) => (
                <Pill key={reason} tone="neutral" label={reasonLabel(reason)} />
              ))}
            </View>
            <View
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radii.md,
                borderLeftWidth: 4,
                borderLeftColor: item.body !== null ? theme.colors.error : theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
              }}
            >
              {item.body !== null ? (
                <Text variant="body" selectable>
                  {item.body}
                </Text>
              ) : (
                <Text variant="bodySm" color="textMuted">
                  Texto oculto. Ligue “Mostrar textos denunciados” para decidir.
                </Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Remover"
                  icon="delete-outline"
                  size="md"
                  fullWidth
                  disabled={moderate.isPending || item.body === null}
                  onPress={() => decide(item, 'remove')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Manter"
                  icon="check"
                  variant="secondary"
                  size="md"
                  fullWidth
                  disabled={moderate.isPending || item.body === null}
                  onPress={() => decide(item, 'restore')}
                />
              </View>
            </View>
          </Card>
        ))
      )}
    </FormScreen>
  );
}
