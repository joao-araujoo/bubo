import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Button, Card, Text } from '../../design-system';
import { readSessionDraft, type SessionDraft } from './draft-storage';

export function RecoveryCard({ userId }: { userId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      readSessionDraft(userId)
        .then((value) => {
          if (active) setDraft(value);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [userId]),
  );
  if (!draft) return null;
  return (
    <Card>
      <Text variant="titleSm">Sua leitura ficou guardada</Text>
      <Text variant="bodySm">
        {draft.endedAt
          ? 'Retome o registro da página e da reflexão.'
          : 'Você tinha uma sessão em andamento neste aparelho.'}
      </Text>
      <Button
        label="Retomar sessão"
        onPress={() =>
          router.push({ pathname: '/sessao/[id]', params: { id: draft.shelfEntryId } })
        }
      />
    </Card>
  );
}
