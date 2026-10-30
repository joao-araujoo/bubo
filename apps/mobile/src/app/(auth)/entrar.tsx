import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

import {
  BuboMascot,
  Button,
  FormScreen,
  InlineMessage,
  LinkButton,
  Text,
  TextField,
} from '../../design-system';
import { fieldErrors, signInSchema } from '../../features/auth/messages';
import { signInWithPassword } from '../../features/auth/sign-in';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      haptics.warning();
      return;
    }
    setErrors({});
    setSubmitting(true);
    const outcome = await signInWithPassword(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (outcome.kind === 'error') {
      setFormError(outcome.message);
      haptics.error();
      return;
    }
    haptics.success();
    // Untrusted device: the password was right, now a code goes to the reader's e-mail (ADR-038).
    if (outcome.kind === 'code') {
      router.push({ pathname: '/codigo', params: { email: parsed.data.email } });
    }
    // Otherwise the session change flips the navigation guard (onboarding or Hoje).
  }

  return (
    <FormScreen
      brand
      footer={
        <LinkButton
          label="Ainda não tem uma conta? Criar conta grátis"
          onPress={() => router.replace('/cadastro')}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <BuboMascot animated pose="welcome" size={72} />
        <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          Entrar na sua Estante
        </Text>
      </View>
      {formError ? <InlineMessage tone="error" message={formError} /> : null}
      <TextField
        label="E-mail"
        icon="mail-outline"
        placeholder="seu.email@exemplo.com"
        value={email}
        onChangeText={setEmail}
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
        placeholder="Sua senha"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <LinkButton
        label="Esqueci minha senha"
        align="right"
        onPress={() => router.push('/esqueci-senha')}
      />
      <Button
        label="Entrar no Bubo"
        icon="arrow-forward"
        fullWidth
        loading={submitting}
        onPress={submit}
      />
    </FormScreen>
  );
}
