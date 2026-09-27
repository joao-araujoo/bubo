import { useRouter } from 'expo-router';

import { Button, EmptyState, Screen } from '../design-system';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen scroll={false}>
      <EmptyState
        mascot="notFound"
        title="Página não encontrada"
        description="Esse caminho não existe no Bubo."
        action={<Button label="Voltar para Hoje" fullWidth onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
