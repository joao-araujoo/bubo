import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthHero } from '../../src/components/layout/AuthHero';
import { BuboScreen } from '../../src/components/layout/BuboScreen';
import { BuboButton } from '../../src/components/ui/BuboButton';
import { BuboInput } from '../../src/components/ui/BuboInput';
import { authClient } from '../../src/lib/auth-client';
import { colors, fonts, spacing, typography } from '../../src/theme/tokens';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !email.trim() || !password || !confirmation) {
      setError('Preencha todos os campos.');
      return;
    }
    if (password.length < 8) {
      setError('Sua senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!accepted) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (result.error) {
        setError(result.error.message ?? 'Não foi possível criar sua conta.');
        return;
      }
      router.replace('/(onboarding)/welcome');
    } catch {
      setError('Não conseguimos criar sua conta agora. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BuboScreen>
      <AuthHero
        mascot="reading"
        title="Comece sua jornada"
        message="Crie sua estante viva e nunca mais esqueça os melhores insights dos seus livros."
      />

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Criar minha conta</Text>
        <Text style={styles.subtitle}>
          Preencha seus dados para calibrar seu ritmo de leitura.
        </Text>
      </View>

      <View style={styles.form}>
        <BuboInput label="Nome completo" value={name} onChangeText={setName} autoComplete="name" />
        <BuboInput
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <BuboInput
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
        />
        <BuboInput
          label="Confirmar senha"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
        />

        <Text onPress={() => setAccepted((value) => !value)} style={styles.consent}>
          <Text style={styles.checkbox}>{accepted ? '☑' : '☐'} </Text>
          Concordo com os Termos de Uso e a Política de Privacidade do Bubo.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <BuboButton label="Criar Minha Conta" onPress={submit} loading={submitting} />
      </View>

      <Text style={styles.footer}>
        Já possui uma conta no Bubo?{' '}
        <Link href="/(auth)/login" style={styles.link}>Fazer login</Link>
      </Text>
    </BuboScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { marginTop: spacing.xl, gap: 5 },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  form: { marginTop: spacing.xl, gap: 14 },
  consent: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  checkbox: {
    color: colors.primary,
    fontFamily: fonts.extraBold,
    fontSize: 17,
  },
  error: {
    color: colors.error,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    marginTop: 24,
    marginBottom: 10,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  link: { color: colors.primaryPressed, fontFamily: fonts.bold },
});
