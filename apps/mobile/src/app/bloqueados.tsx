import { ActivityIndicator, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  FormScreen,
  InlineMessage,
  Text,
} from '../design-system';
import { useBlocks, useUnblockUser } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

/** Você → Leitores bloqueados: see and undo blocks made in club debates. */
export default function BlockedReadersScreen() {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const blocks = useBlocks(userId || undefined);
  const unblock = useUnblockUser(userId);

  return (
    <FormScreen title="Leitores bloqueados" eyebrow="Comunidade">
      {blocks.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando" />
      ) : blocks.isError ? (
        <Card>
          <InlineMessage tone="error" message="Não foi possível carregar agora." />
          <Button
            label="Tentar de novo"
            variant="secondary"
            size="md"
            icon="refresh"
            onPress={() => void blocks.refetch()}
          />
        </Card>
      ) : blocks.data.blocks.length === 0 ? (
        <Card>
          <EmptyState
            mascot="emptyCommunity"
            title="Ninguém bloqueado"
            description="Se alguém incomodar em um clube, use “Bloquear autor” no debate. Tudo o que a pessoa escreve some para você."
          />
        </Card>
      ) : (
        <>
          <Text variant="bodySm" color="textMuted">
            Os debates e respostas dessas pessoas não aparecem para você.
          </Text>
          {blocks.data.blocks.map((block) => (
            <Card key={block.userId}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Avatar name={block.name} size={44} />
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
                  {block.name}
                </Text>
                <Button
                  label="Desbloquear"
                  variant="secondary"
                  size="md"
                  compact
                  loading={unblock.isPending && unblock.variables === block.userId}
                  accessibilityHint={`Volta a mostrar o que ${block.name} escreve`}
                  onPress={() =>
                    unblock.mutate(block.userId, {
                      onSuccess: () => haptics.success(),
                      onError: () => haptics.error(),
                    })
                  }
                />
              </View>
            </Card>
          ))}
          {unblock.isError ? (
            <InlineMessage tone="error" message="Não foi possível desbloquear agora." />
          ) : null}
        </>
      )}
    </FormScreen>
  );
}
