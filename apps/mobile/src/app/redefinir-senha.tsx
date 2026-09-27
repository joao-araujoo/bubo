import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

import {
  BuboMascot,
  Button,
  EmptyState,
  FormScreen,
  InlineMessage,
  Text,
  TextField,
} from '../design-system';
import { authErrorMessage, fieldErrors, resetPasswordSchema } from '../features/auth/messages';
import { authClient } from '../lib/auth/client';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

/** Opened from the e-mailed link: bubo://redefinir-senha?token=… (or ?error=INVALID_TOKEN). */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const confirmRef = useRef<TextInput>(null);
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Guards redirect to the right place if the reader is already signed in.
  const leave = () => router.replace('/entrar');

  if (!token || params.error) {
    return (
      <FormScreen footer={<Button label="Voltar" fullWidth onPress={leave} />}>
        <EmptyState
          mascot="error"
          title="Link inválido ou expirado"
          description="Peça um novo link em “Esqueci minha senha”. Por segurança, cada link vale por 1 hora e só pode ser usado uma vez."
        />
      </FormScreen>
    );
  }

  async function submit() {
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      haptics.warning();
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await authClient.resetPassword({ newPassword: parsed.data.password, token });
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error));
      haptics.error();
      return;
    }
    haptics.success();
    setDone(true);
  }

  return (
    <FormScreen
      brand
      footer={
        done ? (
          <Button label="Entrar com a nova senha" icon="login" fullWidth onPress={leave} />
        ) : (
          <Button
            label="Salvar nova senha"
            icon="lock-reset"
            fullWidth
            loading={submitting}
            onPress={submit}
          />
        )
      }
    >
      <View style={{ alignItems: 'center' }}>
        <BuboMascot animated pose={done ? 'confident' : 'doubt'} size={120} />
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading" accessibilityRole="header">
          Crie uma nova senha
        </Text>
        <Text variant="body" color="textMuted">
          Depois de salvar, você sai de todos os aparelhos e entra de novo com a nova senha.
        </Text>
      </View>
      {formError ? <InlineMessage tone="error" message={formError} /> : null}
      {done ? (
        <InlineMessage tone="success" message="Senha atualizada. Agora é só entrar de novo." />
      ) : (
        <>
          <TextField
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            label="Nova senha"
            icon="lock-outline"
            secure
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChangeText={(password) => setForm((f) => ({ ...f, password }))}
            error={errors.password}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TextField
            ref={confirmRef}
            label="Confirmar nova senha"
            icon="lock-reset"
            secure
            placeholder="Repita a nova senha"
            value={form.confirmPassword}
            onChangeText={(confirmPassword) => setForm((f) => ({ ...f, confirmPassword }))}
            error={errors.confirmPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </>
      )}
    </FormScreen>
  );
}
