import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { BuboMascot, Button, FormScreen, InlineMessage, Text, TextField } from '../design-system';
import { authErrorMessage } from '../features/auth/messages';
import { authClient } from '../lib/auth/client';
import { useAuthState } from '../lib/auth/session';
import { clearSessionDraft } from '../features/session/draft-storage';
import { haptics } from '../lib/haptics';
import { clearQueryCache } from '../lib/query/persist';
import { useTheme } from '../theme';

/**
 * In-app account deletion (App Store / Google Play requirement, LGPD). The password is
 * re-checked on the server; all of the reader's data is erased.
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const auth = useAuthState();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    if (password === '') {
      setError('Digite sua senha para confirmar.');
      haptics.warning();
      return;
    }
    setError(null);
    setDeleting(true);
    const result = await authClient.deleteUser({ password });
    setDeleting(false);
    if (result.error) {
      haptics.error();
      setError(
        result.error.code === 'INVALID_PASSWORD'
          ? 'Senha incorreta.'
          : authErrorMessage(result.error),
      );
      return;
    }
    haptics.success();
    if (auth.status === 'ready') await clearSessionDraft(auth.userId);
    // Session is gone: drop cached data; the guard returns to the welcome screen.
    await clearQueryCache(queryClient);
  }

  return (
    <FormScreen
      footer={
        <Button
          label="Excluir minha conta"
          icon="delete-forever"
          fullWidth
          loading={deleting}
          onPress={confirm}
          accessibilityHint="Apaga permanentemente sua conta e todos os seus dados"
        />
      }
    >
      <View style={{ alignItems: 'center' }}>
        <BuboMascot state="streakAtRisk" size={140} />
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading" accessibilityRole="header">
          Excluir conta
        </Text>
        <Text variant="body" color="textMuted">
          Isso apaga para sempre sua conta, sua estante, suas sessões, reflexões e cards de revisão.
          Não dá para desfazer.
        </Text>
      </View>
      <InlineMessage tone="error" message="Esta ação é permanente." />
      {error ? <InlineMessage tone="error" message={error} /> : null}
      <TextField
        label="Sua senha"
        icon="lock-outline"
        secure
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={confirm}
      />
    </FormScreen>
  );
}
