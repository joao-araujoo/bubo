import { TRUSTED_DEVICE_DAYS } from '@bubo/domain';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

import {
  Button,
  Card,
  FormScreen,
  InlineMessage,
  LinkButton,
  Text,
  TextField,
  Toggle,
} from '../../design-system';
import { authErrorMessage, changePasswordSchema, fieldErrors } from '../../features/auth/messages';
import { SettingsSection } from '../../features/settings/SettingsSection';
import { queryKeys } from '../../lib/api/queries';
import { authClient } from '../../lib/auth/client';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { refreshPushRegistration } from '../../lib/notifications';
import { useTheme } from '../../theme';

/**
 * Conta e segurança (ADR-038/039): the e-mailed login code, password change, other devices and
 * the way out. Every change re-checks the password on the server.
 */
export default function SecuritySettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const queryClient = useQueryClient();
  const me = auth.status === 'ready' ? auth.me : null;
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const codeEnabled = me?.user.twoFactorEnabled ?? false;
  const codeAvailable = me?.loginCodeAvailable ?? false;

  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [codePassword, setCodePassword] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [password, setPassword] = useState({
    currentPassword: '',
    password: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [devicesBusy, setDevicesBusy] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);

  async function afterSessionChange() {
    // Enabling/disabling the code and changing the password rotate the session; push tokens are
    // bound to sessions (ADR-028), so this device registers again right away.
    await queryClient.invalidateQueries({ queryKey: queryKeys.me(userId ?? 'anonymous') });
    if (userId) void refreshPushRegistration(userId);
  }

  async function toggleLoginCode() {
    if (codeBusy) return;
    if (!codePassword) {
      setCodeError('Digite sua senha para confirmar.');
      haptics.warning();
      return;
    }
    setCodeError(null);
    setNotice(null);
    setCodeBusy(true);
    const result = codeEnabled
      ? await authClient.twoFactor.disable({ password: codePassword })
      : await authClient.twoFactor.enable({ password: codePassword, method: 'otp' });
    setCodeBusy(false);
    if (result.error) {
      setCodeError(authErrorMessage(result.error));
      haptics.error();
      return;
    }
    haptics.success();
    setCodePassword('');
    setConfirming(false);
    setNotice(
      codeEnabled
        ? 'Código de entrada desligado. A senha passa a bastar em qualquer aparelho.'
        : 'Código de entrada ligado. Aparelhos novos pedem o código do seu e-mail.',
    );
    await afterSessionChange();
  }

  async function changePassword() {
    if (passwordBusy) return;
    setPasswordError(null);
    setNotice(null);
    const parsed = changePasswordSchema.safeParse(password);
    if (!parsed.success) {
      setPasswordErrors(fieldErrors(parsed.error));
      haptics.warning();
      return;
    }
    setPasswordErrors({});
    setPasswordBusy(true);
    const result = await authClient.changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.password,
      revokeOtherSessions: true,
    });
    setPasswordBusy(false);
    if (result.error) {
      setPasswordError(authErrorMessage(result.error));
      haptics.error();
      return;
    }
    haptics.success();
    setPassword({ currentPassword: '', password: '', confirmPassword: '' });
    setNotice(
      'Senha alterada. Os outros aparelhos saíram da conta e um aviso foi para o seu e-mail.',
    );
    await afterSessionChange();
  }

  async function signOutOtherDevices() {
    if (devicesBusy) return;
    setDevicesError(null);
    setNotice(null);
    setDevicesBusy(true);
    const result = await authClient.revokeOtherSessions();
    setDevicesBusy(false);
    if (result.error) {
      setDevicesError(authErrorMessage(result.error));
      haptics.error();
      return;
    }
    haptics.success();
    setNotice('Os outros aparelhos saíram da conta. Este continua conectado.');
  }

  return (
    <FormScreen title="Conta e segurança">
      {notice ? <InlineMessage tone="success" message={notice} /> : null}

      <SettingsSection
        icon="verified-user"
        title="Código de entrada"
        subtitle="Um código no seu e-mail ao entrar em aparelhos novos"
      >
        {!codeAvailable ? (
          <InlineMessage
            tone="info"
            message="Indisponível por enquanto: o servidor ainda não envia e-mails. A senha continua protegendo sua conta."
          />
        ) : null}
        <Toggle
          icon="lock-clock"
          title="Pedir código ao entrar"
          description={`Além da senha, um código de 6 dígitos chega no seu e-mail. Você pode lembrar um aparelho por ${TRUSTED_DEVICE_DAYS} dias.`}
          value={codeEnabled}
          locked={!codeAvailable}
          onValueChange={
            codeAvailable
              ? () => {
                  setCodeError(null);
                  setConfirming((value) => !value);
                }
              : undefined
          }
        />
        {confirming ? (
          <View style={{ gap: theme.spacing.sm }}>
            <TextField
              label="Confirme sua senha"
              icon="lock-outline"
              secure
              value={codePassword}
              onChangeText={(value) => {
                setCodeError(null);
                setCodePassword(value);
              }}
              error={codeError}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void toggleLoginCode()}
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Button
                label="Cancelar"
                variant="secondary"
                size="md"
                compact
                style={{ flex: 1 }}
                onPress={() => {
                  setConfirming(false);
                  setCodePassword('');
                  setCodeError(null);
                }}
              />
              <Button
                label={codeEnabled ? 'Desligar código' : 'Ligar código'}
                size="md"
                compact
                style={{ flex: 1 }}
                loading={codeBusy}
                onPress={() => void toggleLoginCode()}
              />
            </View>
          </View>
        ) : null}
      </SettingsSection>

      <SettingsSection icon="lock-outline" tone="gold" title="Senha">
        {passwordError ? <InlineMessage tone="error" message={passwordError} /> : null}
        <TextField
          label="Senha atual"
          icon="lock-outline"
          secure
          value={password.currentPassword}
          onChangeText={(currentPassword) => setPassword((p) => ({ ...p, currentPassword }))}
          error={passwordErrors.currentPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => newRef.current?.focus()}
        />
        <TextField
          ref={newRef}
          label="Nova senha"
          icon="lock-reset"
          secure
          placeholder="Mínimo 8 caracteres"
          value={password.password}
          onChangeText={(value) => setPassword((p) => ({ ...p, password: value }))}
          error={passwordErrors.password}
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
          value={password.confirmPassword}
          onChangeText={(confirmPassword) => setPassword((p) => ({ ...p, confirmPassword }))}
          error={passwordErrors.confirmPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void changePassword()}
        />
        <Button
          label="Alterar senha"
          icon="lock-reset"
          variant="secondary"
          size="md"
          loading={passwordBusy}
          onPress={() => void changePassword()}
        />
        <Text variant="bodySm" color="textMuted">
          Ao alterar, os outros aparelhos saem da conta e um aviso chega no seu e-mail.
        </Text>
      </SettingsSection>

      <SettingsSection icon="devices" tone="blue" title="Aparelhos">
        {devicesError ? <InlineMessage tone="error" message={devicesError} /> : null}
        <Text variant="bodySm" color="textMuted">
          Entrou em um aparelho que não é seu? Desconecte todos os outros agora. Este continua
          conectado.
        </Text>
        <Button
          label="Sair dos outros aparelhos"
          icon="logout"
          variant="secondary"
          size="md"
          loading={devicesBusy}
          onPress={() => void signOutOtherDevices()}
        />
      </SettingsSection>

      <Card>
        <Text variant="titleSm" accessibilityRole="header">
          Sair do Bubo de vez
        </Text>
        <Text variant="bodySm" color="textMuted">
          Excluir a conta apaga para sempre sua estante, sessões, reflexões e cards. Não dá para
          desfazer.
        </Text>
        <LinkButton
          label="Excluir conta"
          color="error"
          align="left"
          accessibilityHint="Abre a tela para excluir sua conta e seus dados"
          onPress={() => router.push('/excluir-conta')}
        />
      </Card>
    </FormScreen>
  );
}
