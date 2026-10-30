import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { ActionRow, Card, FormScreen, SectionTitle, Text, Toggle } from '../../design-system';
import { SupportContact } from '../../features/legal/LegalDocument';
import { useTheme } from '../../theme';

function Group({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle title={title} />
      {children}
    </View>
  );
}

/**
 * Settings hub (ADR-039): one screen per concern instead of one long form. Account preferences
 * (reading, notifications, e-mails) are saved per screen; device choices apply immediately.
 */
export default function SettingsHubScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? null;
  return (
    <FormScreen title="Configurações">
      <Group title="Leitura e memória">
        <ActionRow
          icon="psychology"
          title="Revisões e leitura"
          subtitle="Ritmo das revisões, foco diário e meta anual"
          onPress={() => router.push('/configuracoes/leitura')}
        />
      </Group>
      <Group title="Avisos">
        <ActionRow
          icon="notifications"
          title="Notificações no celular"
          subtitle="Lembrete de revisão, clubes e amigos"
          onPress={() => router.push('/configuracoes/notificacoes')}
        />
        <ActionRow
          icon="mail-outline"
          title="E-mails do Bubo"
          subtitle="Lembretes de leitura e e-mails da conta"
          onPress={() => router.push('/configuracoes/emails')}
        />
      </Group>
      <Group title="Aparelho">
        <ActionRow
          icon="palette"
          title="Aparência e toque"
          subtitle="Tema e vibração, só neste aparelho"
          onPress={() => router.push('/configuracoes/aparelho')}
        />
        <ActionRow
          icon="widgets"
          title="Widgets"
          subtitle="Prévias e instalação na tela inicial"
          onPress={() => router.push('/widgets')}
        />
      </Group>
      <Group title="Conta">
        <ActionRow
          icon="verified-user"
          title="Conta e segurança"
          subtitle="Código de entrada, senha, aparelhos e exclusão"
          onPress={() => router.push('/configuracoes/seguranca')}
        />
      </Group>
      <Group title="Sobre">
        <ActionRow
          icon="description"
          title="Termos de Uso"
          onPress={() => router.push('/legal/termos')}
        />
        <ActionRow
          icon="privacy-tip"
          title="Política de Privacidade"
          onPress={() => router.push('/legal/privacidade')}
        />
        <SupportContact />
        {version ? (
          <Text variant="bodySm" color="textMuted" align="center">
            {`Bubo ${version}`}
          </Text>
        ) : null}
      </Group>
      <Card>
        <Toggle
          icon="shield"
          title="Anti-spoiler"
          description="Conteúdos além da sua página ficam cobertos. Sempre ativo nos clubes."
          value
          locked
        />
      </Card>
    </FormScreen>
  );
}
