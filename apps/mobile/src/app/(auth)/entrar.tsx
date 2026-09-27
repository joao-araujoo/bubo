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
import { authErrorMessage, fieldErrors, signInSchema } from '../../features/auth/messages';
import { authClient } from '../../lib/auth/client';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
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
    const { error } = await authClient.signIn.email(parsed.data);
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error));
      haptics.error();
      return;
    }
    haptics.success();
    // The session change flips the navigation guard (onboarding or Hoje).
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
        <Card containerStyle={{ flex: 1 }} style={{ padding: theme.spacing.md }}>
          <Text variant="bodySm">
            Que bom ter você de volta! Suas memórias literárias continuam vivas e salvas aqui.
          </Text>
        </Card>
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading" accessibilityRole="header">
          Entrar na sua Estante
        </Text>
        <Text variant="body" color="textMuted">
          Acesse suas sessões ativas e a fila de repetição espaçada.
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
