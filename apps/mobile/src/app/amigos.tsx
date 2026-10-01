import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  FormScreen,
  InlineMessage,
  Text,
  Toggle,
} from '../design-system';
import {
  useChangeFriend,
  useFriends,
  useFriendsFeed,
  useSaveSocialPreferences,
  useBlockUser,
} from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';

export default function FriendsScreen() {
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const list = useFriends(userId);
  const feed = useFriendsFeed(userId);
  const change = useChangeFriend(userId ?? '');
  const preferences = useSaveSocialPreferences(userId ?? '');
  const block = useBlockUser(userId ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <FormScreen title="Amigos de leitura" eyebrow="Comunidade">
      {notice ? <InlineMessage tone="success" message={notice} /> : null}
      {change.isError || preferences.isError || block.isError ? (
        <InlineMessage
          tone="error"
          message="Não foi possível concluir. Atualize e tente novamente."
        />
      ) : null}
      <Button
        label="Atualizar"
        variant="secondary"
        size="md"
        onPress={() => {
          void list.refetch();
          void feed.refetch();
        }}
      />
      {list.isPending ? (
        <ActivityIndicator accessibilityLabel="Carregando amigos" />
      ) : list.isError ? (
        <InlineMessage tone="error" message="Não foi possível carregar seus amigos." />
      ) : (
        <>
          <Card>
            <Text variant="titleSm">Sua privacidade</Text>
            <Toggle
              title="Receber pedidos de amizade"
              description="Somente pessoas dos seus clubes. Desativar também cancela pedidos recebidos pendentes."
              value={list.data.preferences.allowRequests}
              onValueChange={(value) => {
                if (!preferences.isPending)
                  preferences.mutate({ ...list.data.preferences, allowRequests: value });
              }}
            />
            <Toggle
              title="Compartilhar próximas leituras"
              description="Amigos aceitos poderão ver livro de catálogo, minutos e páginas das novas sessões. Suas reflexões e respostas de memória permanecem privadas. Desativar oculta a atividade compartilhada."
              value={list.data.preferences.shareActivity}
              onValueChange={(value) => {
                if (!preferences.isPending)
                  preferences.mutate({ ...list.data.preferences, shareActivity: value });
              }}
            />
          </Card>
          {list.data.friends.length === 0 ? (
            <EmptyState
              mascot="emptyCommunity"
              title="Leituras também aproximam"
              description="Abra um clube → Membros para enviar um pedido de amizade. A outra pessoa escolhe se aceita."
            />
          ) : (
            list.data.friends.map((friend) => (
              <Card key={friend.userId}>
                <Text variant="titleSm">{friend.name}</Text>
                <Text variant="bodySm">
                  {friend.status === 'accepted'
                    ? 'Amizade aceita'
                    : friend.status === 'incoming'
                      ? 'Quer ler junto com você'
                      : 'Pedido enviado'}
                </Text>
                {friend.status === 'incoming' ? (
                  <Button
                    label="Aceitar amizade"
                    disabled={change.isPending}
                    onPress={() => change.mutate({ otherId: friend.userId, action: 'accept' })}
                  />
                ) : null}
                <Button
                  label={
                    friend.status === 'accepted'
                      ? 'Remover amizade'
                      : friend.status === 'incoming'
                        ? 'Recusar pedido'
                        : 'Cancelar pedido'
                  }
                  variant="secondary"
                  disabled={change.isPending}
                  onPress={() =>
                    Alert.alert(
                      'Confirmar?',
                      'A atividade dessa pessoa deixa de aparecer para você.',
                      [
                        { text: 'Manter', style: 'cancel' },
                        {
                          text: 'Confirmar',
                          onPress: () =>
                            change.mutate({ otherId: friend.userId, action: 'remove' }),
                        },
                      ],
                    )
                  }
                />
                <Button
                  label="Bloquear leitor"
                  variant="secondary"
                  disabled={block.isPending}
                  onPress={() =>
                    Alert.alert(
                      `Bloquear ${friend.name}?`,
                      'A amizade será removida e novos pedidos serão impedidos enquanto houver bloqueio.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Bloquear',
                          style: 'destructive',
                          onPress: () =>
                            block.mutate(friend.userId, {
                              onSuccess: () => setNotice('Leitor bloqueado.'),
                            }),
                        },
                      ],
                    )
                  }
                />
              </Card>
            ))
          )}
        </>
      )}
      <Text variant="titleSm">Leituras dos amigos</Text>
      {feed.isPending ? (
        <ActivityIndicator accessibilityLabel="Carregando leituras compartilhadas" />
      ) : feed.isError ? (
        <InlineMessage
          tone="error"
          message="Não foi possível carregar as leituras compartilhadas."
        />
      ) : feed.data.items.length === 0 ? (
        <Text variant="bodySm" color="textMuted">
          Nenhuma atividade compartilhada ainda. Só aparecem novas sessões de livros de catálogo
          após a amizade e a ativação do compartilhamento.
        </Text>
      ) : (
        feed.data.items.map((item) => (
          <Card key={item.id}>
            <Text variant="bodyStrong">
              {item.name} leu {item.bookTitle}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {item.minutes} minutos · {item.pages} páginas ·{' '}
              {new Date(item.endedAt).toLocaleDateString('pt-BR')}
            </Text>
          </Card>
        ))
      )}
    </FormScreen>
  );
}
