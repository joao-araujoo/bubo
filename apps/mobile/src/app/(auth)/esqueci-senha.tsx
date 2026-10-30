import { EMAIL_CODE_TTL_MINUTES } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

import {
  BuboMascot,
  Button,
  CodeField,
  FormScreen,
  InlineMessage,
  LinkButton,
  Text,
  TextField,
} from '../../design-system';
import {
  authErrorMessage,
  emailSchema,
  fieldErrors,
  resetWithCodeSchema,
} from '../../features/auth/messages';
import { signInWithPassword } from '../../features/auth/sign-in';
import { authClient } from '../../lib/auth/client';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

const RESEND_COOLDOWN_SECONDS = 60;
type Step = 'email' | 'code' | 'done';

/**
 * Password reset by e-mailed code (ADR-038): no deep link to open, the reader types the code and
 * the new password right here. A successful reset signs the reader in on this device (ADR-040), so
 * the new password is never retyped and no second code is asked for. The old link flow
 * (`redefinir-senha`) keeps working for older e-mails.
 */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const confirmRef = useRef<TextInput>(null);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(resend = false) {
    if (submitting || (resend && cooldown > 0)) return;
    setFormError(null);
    setNotice(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setErrors({ email: parsed.error.issues[0]?.message ?? 'Informe um e-mail válido.' });
      haptics.warning();
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await authClient.emailOtp.requestPasswordReset({ email: parsed.data });
    setSubmitting(false);
    if (result.error) {
      setFormError(authErrorMessage(result.error));
      haptics.error();
      return;
    }
    haptics.success();
    setEmail(parsed.data);
    setCode('');
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep('code');
    if (resend) setNotice('Enviamos um novo código. O anterior deixou de valer.');
  }

  async function reset() {
    if (submitting) return;
    setFormError(null);
    const parsed = resetWithCodeSchema.safeParse({ code, ...form });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      haptics.warning();
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await authClient.emailOtp.resetPassword({
      email,
      otp: parsed.data.code,
      password: parsed.data.password,
    });
    if (result.error) {
      setSubmitting(false);
      const message = authErrorMessage(result.error);
      if (message.startsWith('Código') || message.startsWith('Esse código')) {
        setErrors({ code: message });
      } else {
        setFormError(message);
      }
      haptics.error();
      return;
    }
    haptics.success();
    setForm({ password: '', confirmPassword: '' });
    // The API opened a session with the reset itself: the navigation guard takes over from here.
    const session = await authClient.getSession();
    if (session.data) {
      setSubmitting(false);
      setStep('done');
      return;
    }
    // An API without that step: sign in with the new password here instead of asking for it again.
    const outcome = await signInWithPassword(email, parsed.data.password);
    setSubmitting(false);
    if (outcome.kind === 'code') {
      router.replace({ pathname: '/codigo', params: { email, motivo: 'senha' } });
      return;
    }
    if (outcome.kind === 'error') setFormError(outcome.message);
    setStep('done');
  }

  const footer =
    step === 'done' ? (
      <Button
        label="Entrar com a nova senha"
        icon="login"
        fullWidth
        onPress={() => router.replace({ pathname: '/entrar', params: { email } })}
      />
    ) : step === 'code' ? (
      <>
        <Button
          label="Salvar nova senha"
          icon="lock-reset"
          fullWidth
          loading={submitting}
          onPress={() => void reset()}
        />
        <LinkButton
          label="Usar outro e-mail"
          onPress={() => {
            setStep('email');
            setErrors({});
            setFormError(null);
            setNotice(null);
          }}
        />
      </>
    ) : (
      <LinkButton label="Voltar para o login" onPress={() => router.replace('/entrar')} />
    );

  return (
    <FormScreen brand footer={footer}>
      <View style={{ alignItems: 'center' }}>
        <BuboMascot animated pose={step === 'done' ? 'confident' : 'doubt'} size={140} />
      </View>
      <View style={{ gap: theme.spacing.xs, alignItems: 'center' }}>
        <Text variant="heading" align="center" accessibilityRole="header">
          {step === 'email'
            ? 'Esqueceu a senha?'
            : step === 'code'
              ? 'Confira seu e-mail'
              : 'Senha atualizada'}
        </Text>
        <Text variant="body" color="textMuted" align="center">
          {step === 'email'
            ? 'Sem problemas! Digite seu e-mail cadastrado e o Bubo envia um código de 6 dígitos para você criar uma senha nova.'
            : step === 'code'
              ? `Se existir uma conta com ${email}, um código chegou lá. Ele vale por ${EMAIL_CODE_TTL_MINUTES} minutos.`
              : formError
                ? 'Sua senha nova está salva. Entre com ela para continuar.'
                : 'Por segurança, os outros aparelhos foram desconectados. Neste aqui, você já está entrando.'}
        </Text>
      </View>
      {formError ? <InlineMessage tone="error" message={formError} /> : null}
      {notice ? <InlineMessage tone="success" message={notice} /> : null}
      {step === 'email' ? (
        <>
          <TextField
            label="Seu e-mail cadastrado"
            icon="mail-outline"
            placeholder="nome@exemplo.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void requestCode()}
          />
          <Button
            label="Enviar código"
            icon="send"
            fullWidth
            loading={submitting}
            onPress={() => void requestCode()}
          />
          <InlineMessage
            tone="info"
            message="Confira também a caixa de spam se a mensagem não chegar em alguns minutos."
          />
        </>
      ) : null}
      {step === 'code' ? (
        <>
          <CodeField
            value={code}
            onChangeText={(digits) => {
              setErrors((current) => ({ ...current, code: '' }));
              setCode(digits);
            }}
            error={errors.code}
          />
          <LinkButton
            label={cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
            color={cooldown > 0 ? 'textMuted' : 'accentText'}
            onPress={() => void requestCode(true)}
          />
          <TextField
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
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
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
            onSubmitEditing={() => void reset()}
          />
        </>
      ) : null}
      {step === 'done' && !formError ? (
        <InlineMessage
          tone="success"
          message="Senha nova salva. Se não foi você quem pediu, troque a senha de novo em Configurações → Conta e segurança."
        />
      ) : null}
    </FormScreen>
  );
}
