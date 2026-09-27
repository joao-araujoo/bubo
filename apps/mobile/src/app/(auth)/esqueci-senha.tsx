import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  BuboMascot,
  Button,
  FormScreen,
  InlineMessage,
  LinkButton,
  Text,
  TextField,
} from '../../design-system';
import { authErrorMessage, emailSchema } from '../../features/auth/messages';
import { authClient } from '../../lib/auth/client';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Informe um e-mail válido.');
      haptics.warning();
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await authClient.requestPasswordReset({
      email: parsed.data,
      // bubo://redefinir-senha in builds; exp://…/--/redefinir-senha in Expo Go.
      redirectTo: Linking.createURL('/redefinir-senha'),
    });
    setSubmitting(false);
    if (result.error) {
      setFormError(authErrorMessage(result.error));
      haptics.error();
      return;
    }
    haptics.success();
    setSent(true);
  }

  return (
    <FormScreen
      brand
      footer={
        sent ? (
          <Button
            label="Voltar para o login"
            icon="arrow-back"
            variant="secondary"
            fullWidth
            onPress={() => router.replace('/entrar')}
          />
        ) : (
          <LinkButton label="Voltar para o login" onPress={() => router.replace('/entrar')} />
        )
      }
    >
      <View style={{ alignItems: 'center' }}>
        <BuboMascot animated pose={sent ? 'confident' : 'doubt'} size={140} />
      </View>
      <View style={{ gap: theme.spacing.xs, alignItems: 'center' }}>
        <Text variant="heading" align="center" accessibilityRole="header">
          Esqueceu a senha?
        </Text>
        <Text variant="body" color="textMuted" align="center">
          Sem problemas! Digite seu e-mail cadastrado e o Bubo enviará um link seguro para você
          redefinir seu acesso.
        </Text>
      </View>
      {formError ? <InlineMessage tone="error" message={formError} /> : null}
      {sent ? (
        <InlineMessage
          tone="success"
          message="Se existir uma conta com esse e-mail, enviamos um link de recuperação. Confira também a caixa de spam."
        />
      ) : (
        <>
          <TextField
            label="Seu e-mail cadastrado"
            icon="mail-outline"
            placeholder="nome@exemplo.com"
            value={email}
            onChangeText={setEmail}
            error={error}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <Button
            label="Enviar link de recuperação"
            icon="send"
            fullWidth
            loading={submitting}
            onPress={submit}
          />
          <InlineMessage
            tone="info"
            message="Confira também a caixa de spam se a mensagem não chegar em alguns minutos."
          />
        </>
      )}
    </FormScreen>
  );
}
