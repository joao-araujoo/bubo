import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  FormScreen,
  InlineMessage,
  LinkButton,
  Text,
  TextField,
} from '../../design-system';
import { authErrorMessage, fieldErrors, signUpSchema } from '../../features/auth/messages';
import { authClient } from '../../lib/auth/client';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setFormError(null);
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      haptics.warning();
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { name, email, password } = parsed.data;
    const { error } = await authClient.signUp.email({ name, email, password });
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error));
      haptics.error();
      return;
    }
    haptics.success();
    // Auto sign-in → the guard moves the reader to onboarding.
  }

  return (
    <FormScreen
      brand
      footer={
        <LinkButton
          label="Já possui uma conta no Bubo? Fazer login"
          onPress={() => router.replace('/entrar')}
        />
      }
    >
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BuboMascot animated pose="happy" size={64} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="accentText">
            Comece sua jornada
          </Text>
          <Text variant="bodySm">
            Crie sua estante viva e guarde as melhores ideias dos seus livros.
          </Text>
        </View>
      </Card>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading" accessibilityRole="header">
          Criar minha conta
        </Text>
        <Text variant="body" color="textMuted">
          Preencha seus dados para calibrar seu ritmo de leitura.
        </Text>
      </View>
      {formError ? <InlineMessage tone="error" message={formError} /> : null}
      <TextField
        label="Nome"
        icon="person-outline"
        placeholder="Como quer ser chamado?"
        value={form.name}
        onChangeText={set('name')}
        error={errors.name}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label="E-mail"
        icon="mail-outline"
        placeholder="seu.melhor@email.com"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Senha"
        icon="lock-outline"
        secure
        placeholder="Mínimo 8 caracteres"
        value={form.password}
        onChangeText={set('password')}
        error={errors.password}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        label="Confirmar senha"
        icon="lock-reset"
        secure
        placeholder="Repita sua senha"
        value={form.confirmPassword}
        onChangeText={set('confirmPassword')}
        error={errors.confirmPassword}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button
        label="Criar minha conta"
        icon="rocket-launch"
        fullWidth
        loading={submitting}
        onPress={submit}
      />
    </FormScreen>
  );
}
