import { EMAIL_CODE_TTL_MINUTES, TRUSTED_DEVICE_DAYS } from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  BuboMascot,
  Button,
  CodeField,
  FormScreen,
  InlineMessage,
  LinkButton,
  Text,
  Toggle,
} from '../../design-system';
import { authErrorMessage, codeSchema } from '../../features/auth/messages';
import { authClient } from '../../lib/auth/client';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Second step of sign-in on an untrusted device (ADR-038): the code e-mailed by the API. The
 * sign-in screen already asked for the code; this screen verifies it and may trust the device.
 */
export default function LoginCodeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; motivo?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  // Arrived from "Esqueci minha senha": make clear this is a new code, not the password one.
  const afterReset = params.motivo === 'senha';
  const [code, setCode] = useState('');
  const [trust, setTrust] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit() {
    if (submitting) return;
    const parsed = codeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Digite os 6 dígitos do código.');
      haptics.warning();
      return;
    }
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const result = await authClient.twoFactor.verifyOtp({ code: parsed.data, trustDevice: trust });
    setSubmitting(false);
    if (result.error) {
      setError(authErrorMessage(result.error));
      haptics.error();
      return;
    }
    haptics.success();
    // The session cookie arrived: the navigation guard moves to onboarding or Hoje.
  }

  async function resend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    setError(null);
    const result = await authClient.twoFactor.sendOtp();
    setResending(false);
    if (result.error) {
      setError(authErrorMessage(result.error));
      haptics.error();
      return;
    }
    haptics.success();
    setCode('');
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setNotice('Enviamos um novo código. O anterior deixou de valer.');
  }

  return (
    <FormScreen
      brand
      footer={
        <>
          <Button
            label="Entrar"
            icon="arrow-forward"
            fullWidth
            loading={submitting}
            onPress={submit}
          />
          <LinkButton
            label="Usar outra conta"
            onPress={() => router.replace('/entrar')}
            accessibilityHint="Volta para a tela de entrada"
          />
        </>
      }
    >
      <View style={{ alignItems: 'center' }}>
        <BuboMascot animated pose="confident" size={120} />
      </View>
      <View style={{ gap: theme.spacing.xs, alignItems: 'center' }}>
        <Text variant="heading" align="center" accessibilityRole="header">
          Confira seu e-mail
        </Text>
        <Text variant="body" color="textMuted" align="center">
          {email
            ? `Enviamos um código de 6 dígitos para ${email}. Ele vale por ${EMAIL_CODE_TTL_MINUTES} minutos.`
            : `Enviamos um código de 6 dígitos para o seu e-mail. Ele vale por ${EMAIL_CODE_TTL_MINUTES} minutos.`}
        </Text>
      </View>
      {notice ? <InlineMessage tone="success" message={notice} /> : null}
      {afterReset && !notice ? (
        <InlineMessage
          tone="success"
          message="Senha nova salva. Este é um código de entrada novo, diferente do código da senha."
        />
      ) : null}
      <CodeField
        value={code}
        onChangeText={(digits) => {
          setError(null);
          setCode(digits);
        }}
        onSubmitEditing={submit}
        error={error}
        disabled={submitting}
      />
      <Toggle
        icon="devices"
        title="Lembrar este aparelho"
        description={`Por ${TRUSTED_DEVICE_DAYS} dias, entrar neste aparelho não pede código.`}
        value={trust}
        onValueChange={setTrust}
      />
      <LinkButton
        label={
          cooldown > 0
            ? `Reenviar código (${cooldown}s)`
            : resending
              ? 'Enviando…'
              : 'Reenviar código'
        }
        onPress={() => void resend()}
        color={cooldown > 0 || resending ? 'textMuted' : 'accentText'}
        accessibilityHint={
          cooldown > 0 ? 'Disponível em alguns segundos' : 'Envia um novo código por e-mail'
        }
      />
      <InlineMessage
        tone="info"
        message="Não encontrou? Confira a caixa de spam. O Bubo nunca pede seu código por mensagem ou telefone."
      />
    </FormScreen>
  );
}
