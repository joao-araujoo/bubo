import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthHero } from '../../src/components/layout/AuthHero';
import { BuboScreen } from '../../src/components/layout/BuboScreen';
import { BuboButton } from '../../src/components/ui/BuboButton';
import { BuboInput } from '../../src/components/ui/BuboInput';
import { authClient } from '../../src/lib/auth-client';
import { colors, fonts, spacing, typography } from '../../src/theme/tokens';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) {
      setError('Digite o e-mail da sua conta.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: 'bubo://reset-password',
      });
      if (result.error) {
        setError(result.error.message ?? 'Não foi possível enviar o link.');
        return;
      }
      setSent(true);
    } catch {
      setError('Não conseguimos enviar o link agora. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <BuboScreen contentStyle={styles.center}>
        <AuthHero
          mascot="happySparkles"
          title="Dá uma olhada no seu e-mail."
          message="Se esse endereço estiver cadastrado, enviamos um link seguro para você redefinir sua senha."
        />
        <Text style={styles.helper}>
          Pode levar até 2 minutos. Confira também sua caixa de spam.
        </Text>
        <Link href="/(auth)/login" style={styles.back}>Voltar para o Login</Link>
      </BuboScreen>
    );
  }

  return (
    <BuboScreen>
      <AuthHero
        mascot="curiousQuestion"
        title="Esqueceu a senha?"
        message="Sem problemas! O Bubo envia um link seguro para você recuperar o acesso."
      />

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Recuperar acesso</Text>
        <Text style={styles.subtitle}>
          Digite o e-mail usado no seu cadastro.
        </Text>
      </View>

      <View style={styles.form}>
        <BuboInput
          label="Seu E-mail Cadastrado"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <BuboButton
          label="Enviar Link de Recuperação"
          onPress={submit}
          loading={submitting}
        />
        <Text style={styles.helper}>
          O e-mail pode levar até 2 minutos. Confira também sua caixa de spam.
        </Text>
        <Link href="/(auth)/login" style={styles.back}>← Voltar para o Login</Link>
      </View>
    </BuboScreen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', gap: spacing.xl },
  titleBlock: { marginTop: spacing.xl, gap: 5 },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  form: { marginTop: spacing.xl, gap: 14 },
  helper: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  error: {
    color: colors.error,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  back: {
    color: colors.primaryPressed,
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'center',
  },
});
