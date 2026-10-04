import { type TodayData, type TodayDraft } from '@bubo/domain';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Button, Card, Text } from '../../design-system';
import { readSessionDraft, type SessionDraft } from './draft-storage';

/** Missing local storage is different from an unreadable draft; account changes hide old data. */
export function useRecoveryDraft(userId: string | undefined) {
  const request = useRef(0);
  const [snapshot, setSnapshot] = useState<{
    userId: string | undefined;
    result: TodayData<SessionDraft | null>;
  }>({ userId: undefined, result: { state: 'loading' } });
  const reload = useCallback(() => {
    if (!userId) return;
    const current = ++request.current;
    setSnapshot({ userId, result: { state: 'loading' } });
    void readSessionDraft(userId)
      .then((value) => {
        if (current === request.current) setSnapshot({ userId, result: { state: 'ready', value } });
      })
      .catch(() => {
        if (current === request.current) setSnapshot({ userId, result: { state: 'error' } });
      });
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {
        request.current += 1;
      };
    }, [reload]),
  );
  const result: TodayData<SessionDraft | null> =
    snapshot.userId === userId ? snapshot.result : { state: 'loading' };
  return { result, retry: reload };
}

export function RecoveryCard({ draft }: { draft: TodayDraft }) {
  const router = useRouter();
  return (
    <Card>
      <Text variant="titleSm">Sua leitura ficou guardada</Text>
      <Text variant="bodySm">
        {draft.needsSave
          ? 'Retome sua recordação e confirme o envio da sessão.'
          : 'Você tinha uma sessão em andamento neste aparelho.'}
      </Text>
      <Button
        label={draft.needsSave ? 'Concluir sessão guardada' : 'Retomar sessão'}
        icon={draft.needsSave ? 'fact-check' : 'play-arrow'}
        fullWidth
        onPress={() =>
          router.push({ pathname: '/sessao/[id]', params: { id: draft.shelfEntryId } })
        }
      />
    </Card>
  );
}
