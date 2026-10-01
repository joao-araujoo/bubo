import { type GlobalModerationRequest } from '@bubo/contracts';
import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { Button, Card, EmptyState, FormScreen, InlineMessage, Text } from '../design-system';
import { REPORT_REASONS } from '../features/community/meta';
import { useGlobalModeration, useModerationQueue } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';

export default function ModerationScreen() {
  const auth = useAuthState();
  const userId = auth.status === 'ready' && auth.me.isModerator ? auth.userId : undefined;
  const [reveal, setReveal] = useState(false);
  const queue = useModerationQueue(userId, reveal);
  const moderate = useGlobalModeration(userId ?? '');
  function decide(input: GlobalModerationRequest) {
    Alert.alert(
      input.action === 'remove' ? 'Remover este conteúdo?' : 'Manter este conteúdo?',
      'Esta decisão resolve as denúncias abertas e fica registrada na API.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () =>
            moderate.mutate(input, {
              onSuccess: () => haptics.success(),
              onError: () => haptics.error(),
            }),
        },
      ],
    );
  }
  if (!userId)
    return (
      <FormScreen title="Moderação">
        <EmptyState
          mascot="notFound"
          title="Acesso restrito"
          description="Esta área é exclusiva das contas de moderação configuradas pelo proprietário."
        />
      </FormScreen>
    );
  return (
    <FormScreen title="Moderação geral" eyebrow="Comunidade">
      <Text variant="bodySm">
        Denúncias abertas, das mais antigas às mais recentes. Somente conteúdo denunciado aparece
        aqui.
      </Text>
      {!reveal ? (
        <Button
          label="Mostrar conteúdo denunciado"
          variant="secondary"
          onPress={() =>
            Alert.alert(
              'Revelar conteúdo?',
              'Os textos podem conter spoilers ou conteúdo ofensivo.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Mostrar', onPress: () => setReveal(true) },
              ],
            )
          }
        />
      ) : (
        <Button label="Ocultar textos" variant="secondary" onPress={() => setReveal(false)} />
      )}
      {moderate.isError ? (
        <InlineMessage
          tone="error"
          message="Não foi possível concluir a decisão. A denúncia pode já ter sido resolvida; atualize a fila."
        />
      ) : null}
      <Button
        label="Atualizar fila"
        variant="secondary"
        size="md"
        onPress={() => void queue.refetch()}
      />
      {queue.isPending ? (
        <ActivityIndicator accessibilityLabel="Carregando denúncias" />
      ) : queue.isError ? (
        <InlineMessage
          tone="error"
          message="Não foi possível carregar a fila. Confira sua conexão e seu acesso."
        />
      ) : queue.data.items.length === 0 ? (
        <EmptyState
          mascot="emptyCommunity"
          title="Nenhuma denúncia aberta"
          description="Novas denúncias aparecerão aqui para análise."
        />
      ) : (
        queue.data.items.map((item) => (
          <Card key={`${item.targetType}:${item.targetId}`}>
            <Text variant="titleSm">{item.clubName}</Text>
            <Text variant="bodySm">
              {item.reportCount} denúncias ·{' '}
              {item.reasons
                .map(
                  (reason) =>
                    REPORT_REASONS.find((option) => option.value === reason)?.label ?? reason,
                )
                .join(', ')}
            </Text>
            {item.body !== null ? (
              <Text selectable>{item.body}</Text>
            ) : (
              <Text variant="bodySm" color="textMuted">
                Texto oculto. Revele antes de decidir.
              </Text>
            )}
            <Button
              label="Remover conteúdo"
              disabled={moderate.isPending || !reveal}
              onPress={() =>
                decide({
                  clubId: item.clubId,
                  targetType: item.targetType,
                  targetId: item.targetId,
                  action: 'remove',
                })
              }
            />
            <Button
              label="Manter e resolver denúncias"
              variant="secondary"
              disabled={moderate.isPending || !reveal}
              onPress={() =>
                decide({
                  clubId: item.clubId,
                  targetType: item.targetType,
                  targetId: item.targetId,
                  action: 'restore',
                })
              }
            />
          </Card>
        ))
      )}
    </FormScreen>
  );
}
