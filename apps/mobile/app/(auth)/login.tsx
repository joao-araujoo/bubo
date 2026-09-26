import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthHero } from '../../src/components/layout/AuthHero';
import { BuboScreen } from '../../src/components/layout/BuboScreen';
import { BuboButton } from '../../src/components/ui/BuboButton';
import { BuboInput } from '../../src/components/ui/BuboInput';
import { authClient } from '../../src/lib/auth-client';
import { colors, fonts, spacing, typography } from '../../src/theme/tokens';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Preencha seu e-mail e sua senha.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });

      if (result.error) {
        setError(result.error.message ?? 'Não foi possível entrar.');
        return;
      }

      router.replace('/(tabs)/today');
    } catch {
      setError('Não conseguimos falar com o Bubo agora. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BuboScreen>
      <View style={styles.headerGap} />
      <AuthHero
        title="Que bom ter você de volta!"
        message="Suas memórias literárias continuam vivas e salvas aqui."
      />

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Entrar no Bubo</Text>
        <Text style={styles.subtitle}>
          Acesse suas sessões ativas e a fila de repetição espaçada.
        </Text>
      </View>

      <View style={styles.form}>
        <BuboInput
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="voce@exemplo.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <BuboInput
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder="Sua senha"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />

        <Link href="/(auth)/forgot-password" style={styles.forgot}>
          Esqueci minha senha
        </Link>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <BuboButton
          label="Entrar no Bubo"
          onPress={submit}
          loading={submitting}
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.or}>ou continue com</Text>
          <View style={styles.divider} />
        </View>

        <BuboButton
          label="Continuar com Google"
          variant="secondary"
          disabled
          leading={<Text style={styles.google}>G</Text>}
        />

        <Text style={styles.googleHint}>
          O login com Google será ativado quando as credenciais OAuth forem configuradas.
        </Text>
      </View>

      <Text style={styles.footer}>
        Ainda não tem uma conta?{' '}
        <Link href="/(auth)/sign-up" style={styles.link}>
          Criar conta grátis
        </Link>
      </Text>
    </BuboScreen>
  );
}

const styles = StyleSheet.create({
  headerGap: { height: 8 },
  titleBlock: {
    marginTop: spacing.xl,
    gap: 5,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  form: {
    marginTop: spacing.xl,
    gap: 14,
  },
  forgot: {
    color: colors.primaryPressed,
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'right',
  },
  error: {
    color: colors.error,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  divider: {
    height: 2,
    flex: 1,
    backgroundColor: colors.border,
  },
  or: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  google: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 17,
  },
  googleHint: {
    marginTop: -6,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    marginTop: 24,
    marginBottom: 10,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  link: {
    color: colors.primaryPressed,
    fontFamily: fonts.bold,
  },
});
