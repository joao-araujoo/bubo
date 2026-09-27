import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { BookCover, BuboMascot, Button, Card, Chip, FormScreen, Text } from '../../design-system';
import { useOnboarding } from '../../features/onboarding/OnboardingProvider';
import { ONBOARDING_TOTAL_STEPS } from '../../features/onboarding/options';
import { useFinishOnboarding } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/** Onboarding 6/6 — Pronto! (answers are already saved; this screen only celebrates). */
export default function DoneStep() {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'needs_onboarding' || auth.status === 'ready' ? auth.userId : '';
  const finish = useFinishOnboarding(userId);
  const { draft } = useOnboarding();

  if (!draft.saved) return <Redirect href="/onboarding" />;
  const saved = draft.saved;
  const book = draft.firstBook;

  return (
    <FormScreen
      back={false}
      step={{ current: 6, total: ONBOARDING_TOTAL_STEPS }}
      footer={
        <Button
          label="Ir para o Bubo (Hoje)"
          icon="arrow-forward"
          fullWidth
          onPress={() => {
            haptics.commit();
            // Updating the cached profile flips the navigation guard to the tabs.
            finish(saved);
          }}
        />
      }
    >
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <BuboMascot animated state="sessionComplete" size={200} />
        <Chip
          label={book ? 'Estante calibrada' : 'Perfil calibrado'}
          icon="verified"
          eyebrow
          align="center"
        />
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display" align="center" accessibilityRole="header">
          {book ? 'Sua estante está pronta!' : 'Seu perfil está pronto!'}
        </Text>
        <Text variant="bodyLg" color="textMuted" align="center">
          {book
            ? 'Sua estante está pronta. O Bubo organizou seu primeiro livro para a sua primeira sessão de leitura profunda.'
            : 'Seu perfil de leitura está pronto. Quando quiser, adicione um livro pela Estante.'}
        </Text>
      </View>
      {book ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BookCover
            title={book.title}
            author={book.author}
            coverUrls={book.coverUrls}
            width={60}
          />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Chip label="Primeiro livro ativo" tone="success" icon="bolt" iconColor="onSuccess" />
            <Text variant="titleSm">{book.title}</Text>
            {book.author ? (
              <Text variant="bodySm" color="textMuted">
                {book.author}
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}
    </FormScreen>
  );
}
