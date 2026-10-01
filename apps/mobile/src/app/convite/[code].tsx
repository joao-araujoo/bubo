import { normalizeInviteCode } from '@bubo/domain';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button, EmptyState, FormScreen, InlineMessage } from '../../design-system';
import { ClubProfile } from '../../features/community/club/ClubProfile';
import { GuidelinesTab } from '../../features/community/club/GuidelinesTab';
import { ApiError } from '../../lib/api/client';
import { useInvitePreview, useJoinByCode } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/**
 * An invite link (`bubo://convite/ABCD2345`) or a typed code: the club profile (Stitch "Perfil do
 * clube") before joining, then join by code, which also opens private clubs. Members go straight
 * to the club.
 */
export default function InviteLinkScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeInviteCode(typeof params.code === 'string' ? params.code : '') ?? '';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const preview = useInvitePreview(userId || undefined, code);
  const join = useJoinByCode(userId);
  const [showGuidelines, setShowGuidelines] = useState(false);

  const header = { title: 'Convite do clube', eyebrow: 'Clube de leitura', align: 'left' } as const;

  if (!code) {
    return (
      <FormScreen {...header}>
        <EmptyState
          mascot="notFound"
          title="Código inválido"
          description="Um convite tem 8 letras e números, como ABCD-2345. Confira com quem te convidou."
        />
      </FormScreen>
    );
  }
  if (preview.isPending) {
    return (
      <FormScreen {...header}>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Abrindo convite" />
      </FormScreen>
    );
  }
  if (preview.isError) {
    const gone = preview.error instanceof ApiError && preview.error.code === 'NOT_FOUND';
    return (
      <FormScreen {...header}>
        <EmptyState
          mascot={gone ? 'notFound' : 'offline'}
          title={gone ? 'Convite expirado' : 'Não foi possível abrir'}
          description={
            gone
              ? 'Este código não abre nenhum clube. O criador pode ter gerado um novo código ou excluído o clube.'
              : 'Verifique sua conexão e tente de novo.'
          }
          action={
            gone ? undefined : (
              <Button
                label="Tentar de novo"
                icon="refresh"
                onPress={() => void preview.refetch()}
              />
            )
          }
        />
      </FormScreen>
    );
  }

  const club = preview.data;
  if (club.membership !== null) {
    return <Redirect href={{ pathname: '/clubes/[id]', params: { id: club.id } }} />;
  }

  const joinClub = () =>
    join.mutate(code, {
      onSuccess: (joined) => {
        haptics.success();
        router.replace({ pathname: '/clubes/[id]', params: { id: joined.id } });
      },
      onError: () => haptics.error(),
    });

  const footer = (
    <>
      {join.isError ? (
        <InlineMessage
          tone="error"
          message={
            join.error instanceof ApiError && join.error.code === 'NOT_FOUND'
              ? 'Este convite deixou de valer. Peça um novo código.'
              : 'Não foi possível entrar agora.'
          }
        />
      ) : null}
      <Button
        label="Aceitar convite e diretrizes"
        icon="group-add"
        fullWidth
        loading={join.isPending}
        onPress={joinClub}
      />
    </>
  );

  if (showGuidelines) {
    return (
      <FormScreen {...header} title="Diretrizes & blindagem" eyebrow={club.name} footer={footer}>
        <Button
          label="Voltar ao convite"
          icon="arrow-back"
          variant="secondary"
          size="md"
          onPress={() => setShowGuidelines(false)}
        />
        <GuidelinesTab club={club} ownerName={club.ownerName} />
      </FormScreen>
    );
  }

  return (
    <FormScreen {...header} eyebrowDot footer={footer}>
      <ClubProfile
        club={club}
        joining={join.isPending}
        joinLabel="Aceitar convite"
        onJoin={joinClub}
        onInvite={() => undefined}
        onGuidelines={() => setShowGuidelines(true)}
      />
    </FormScreen>
  );
}
