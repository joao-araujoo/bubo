import { formatInviteCode } from '@bubo/domain';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentProps, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, View } from 'react-native';

import {
  BuboTip,
  Button,
  EmptyState,
  FormScreen,
  Icon,
  IconTile,
  type IconTileTone,
  InlineMessage,
  Pill,
  Raised,
  Text,
} from '../../design-system';
import { InviteQr } from '../../features/community/InviteQr';
import { CLUB_ICON_META } from '../../features/community/meta';
import { useClub, useRegenerateInviteCode } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { fontFamily, useTheme } from '../../theme';

type IconName = ComponentProps<typeof Icon>['name'];

/** Purple corner brackets around the QR (Stitch scanner frame). */
function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const theme = useTheme();
  const top = position === 'tl' || position === 'tr';
  const left = position === 'tl' || position === 'bl';
  return (
    <View
      style={{
        position: 'absolute',
        width: 22,
        height: 22,
        ...(top ? { top: 8 } : { bottom: 8 }),
        ...(left ? { left: 8 } : { right: 8 }),
        borderColor: theme.colors.primary,
        borderTopWidth: top ? 3 : 0,
        borderBottomWidth: top ? 0 : 3,
        borderLeftWidth: left ? 3 : 0,
        borderRightWidth: left ? 0 : 3,
        borderTopLeftRadius: position === 'tl' ? 8 : 0,
        borderTopRightRadius: position === 'tr' ? 8 : 0,
        borderBottomLeftRadius: position === 'bl' ? 8 : 0,
        borderBottomRightRadius: position === 'br' ? 8 : 0,
      }}
    />
  );
}

/** Stitch "Compartilhar rapidamente" tile. */
function ShareTile({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string;
  icon: IconName;
  tone: IconTileTone;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Compartilhar por ${label}`}
      onPress={() => {
        haptics.press();
        onPress();
      }}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.border}
          rimColor={theme.colors.secondaryRim}
          radius={theme.radii.lg}
          depth={4}
          pressed={pressed}
          faceStyle={{
            minHeight: 76,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <IconTile icon={icon} tone={tone} size={34} round />
          <Text variant="label" style={{ fontSize: 12 }} numberOfLines={1}>
            {label}
          </Text>
        </Raised>
      )}
    </Pressable>
  );
}

/**
 * Stitch "Convidar membros": the club card, a real QR of the invite link, the link with copy, quick
 * share and how the anti-spoiler protects whoever joins. The invite works for public and private
 * clubs; only the owner can replace the code (old links stop working).
 */
export default function InviteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId: string }>();
  const clubId = typeof params.clubId === 'string' ? params.clubId : '';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const club = useClub(userId || undefined, clubId);
  const regenerate = useRegenerateInviteCode(userId, clubId);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const header = { title: 'Convidar Membros', eyebrow: 'Convite do clube', align: 'left' } as const;

  if (club.isPending) {
    return (
      <FormScreen {...header}>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando convite" />
      </FormScreen>
    );
  }
  if (club.isError || !club.data.inviteCode || club.data.membership === null) {
    return (
      <FormScreen {...header}>
        <EmptyState
          mascot="notFound"
          title="Convite indisponível"
          description="Só quem participa do clube pode convidar. Entre no clube e tente de novo."
        />
      </FormScreen>
    );
  }

  const data = club.data;
  const code = data.inviteCode ?? '';
  const pretty = formatInviteCode(code);
  const link = Linking.createURL(`convite/${code}`);
  const owner = data.membership === 'owner';
  const message = [
    `Entre no clube "${data.name}" no Bubo para lermos ${data.book.title} juntos, sem spoilers.`,
    '',
    `Toque no link: ${link}`,
    `Ou, no Bubo: Comunidade → Descobrir → "Recebeu um convite?" e digite ${pretty}.`,
  ].join('\n');

  async function copy() {
    try {
      await Clipboard.setStringAsync(link);
      haptics.success();
      setCopied(true);
    } catch {
      haptics.error();
      setShareError('Não foi possível copiar. Segure o link para selecionar.');
    }
  }

  async function shareSheet() {
    setShareError(null);
    try {
      await Share.share({ message });
    } catch {
      setShareError('Não foi possível abrir o compartilhamento agora.');
    }
  }

  async function openApp(url: string) {
    setShareError(null);
    try {
      await Linking.openURL(url);
    } catch {
      await shareSheet();
    }
  }

  const confirmRegenerate = () =>
    Alert.alert(
      'Gerar um novo código?',
      'O link e o QR atuais param de funcionar. Quem já entrou continua no clube.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Gerar novo',
          onPress: () =>
            regenerate.mutate(undefined, {
              onSuccess: () => {
                haptics.success();
                setCopied(false);
              },
              onError: () => haptics.error(),
            }),
        },
      ],
    );

  return (
    <FormScreen
      {...header}
      footer={
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button label="Depois" variant="secondary" compact onPress={() => router.back()} />
          <Button
            label="Compartilhar Convite"
            icon="share"
            onPress={() => void shareSheet()}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <BuboTip pose="happy" title="Companheirismo ativo" titleIcon="group-add">
        Ler junto dá com quem conversar sobre o livro, e explicar uma ideia para alguém é uma ótima
        forma de lembrar dela.
      </BuboTip>

      <Raised
        faceColor={theme.colors.surface}
        borderColor={theme.colors.borderSoft}
        rimColor={theme.colors.cardShadow}
        radius={24}
        depth={theme.sizes.cardRim}
        faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <IconTile icon={CLUB_ICON_META[data.icon].icon} size={52} solid />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleSm" numberOfLines={2}>
              {data.name}
            </Text>
            <Text variant="bodySm" color="textMuted" numberOfLines={2}>
              {'Obra atual: '}
              <Text variant="bodySm" color="accentText" style={{ fontFamily: fontFamily.bold }}>
                {data.book.title}
              </Text>
              {data.weeklyGoalPages ? ` • ${data.weeklyGoalPages}p/sem` : ''}
            </Text>
          </View>
          <Pill
            icon={owner ? 'verified' : data.visibility === 'private' ? 'lock-outline' : 'public'}
            label={owner ? 'Fundador' : data.visibility === 'private' ? 'Privado' : 'Público'}
          />
        </View>

        <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />

        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <View
            style={{
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingTop: theme.spacing.xl,
              paddingBottom: theme.spacing.lg,
              paddingHorizontal: theme.spacing.xl,
              borderRadius: 22,
              borderWidth: theme.sizes.borderWidth,
              borderColor: theme.colors.primarySoft,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <Corner position="tl" />
            <Corner position="tr" />
            <Corner position="bl" />
            <Corner position="br" />
            <InviteQr value={link} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text variant="caption" color="textMuted">
                Código do clube:
              </Text>
              <View
                accessible
                accessibilityLabel={`Código do clube: ${pretty.split('').join(' ')}`}
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.radii.sm,
                  borderWidth: 1,
                  borderColor: theme.colors.purpleLight,
                  backgroundColor: theme.colors.primarySoft,
                }}
              >
                <Text
                  variant="label"
                  color="accentText"
                  selectable
                  style={{ letterSpacing: 2, fontFamily: fontFamily.extrabold }}
                >
                  {pretty}
                </Text>
              </View>
            </View>
          </View>
          <Text variant="bodySm" color="textMuted" align="center">
            Com o Bubo instalado, aponte a câmera do celular para abrir o convite direto no clube.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="label" style={{ flex: 1 }}>
              Link do Convite
            </Text>
            <Icon name="shield" size={14} color="successText" />
            <Text variant="label" color="successText" style={{ fontSize: 12, marginLeft: 4 }}>
              Blindagem Ativa
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              padding: theme.spacing.xs,
              paddingLeft: theme.spacing.md,
              borderRadius: theme.radii.lg,
              borderWidth: theme.sizes.borderWidth,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <Text
              variant="bodySm"
              selectable
              numberOfLines={1}
              style={{ flex: 1, fontFamily: fontFamily.medium }}
            >
              {link}
            </Text>
            <Button
              label={copied ? 'Copiado' : 'Copiar'}
              icon={copied ? 'check' : 'content-copy'}
              variant="secondary"
              size="md"
              compact
              onPress={() => void copy()}
            />
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" color="textMuted">
            Compartilhar rapidamente:
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <ShareTile
              label="WhatsApp"
              icon="chat"
              tone="success"
              onPress={() => void openApp(`https://wa.me/?text=${encodeURIComponent(message)}`)}
            />
            <ShareTile
              label="Telegram"
              icon="telegram"
              tone="blue"
              onPress={() =>
                void openApp(
                  `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`,
                )
              }
            />
            <ShareTile
              label="E-mail"
              icon="mail-outline"
              tone="orange"
              onPress={() =>
                void openApp(
                  `mailto:?subject=${encodeURIComponent(`Convite para o clube ${data.name}`)}&body=${encodeURIComponent(message)}`,
                )
              }
            />
            <ShareTile label="Mais" icon="share" tone="primary" onPress={() => void shareSheet()} />
          </View>
        </View>
        {shareError ? <InlineMessage tone="error" message={shareError} /> : null}
      </Raised>

      {owner ? (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.borderSoft}
          rimColor={theme.colors.cardShadow}
          radius={22}
          depth={3}
          faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Icon name="vpn-key" size={20} color="accentText" />
            <Text variant="label" style={{ flex: 1 }}>
              Código vazou?
            </Text>
          </View>
          <Text variant="bodySm" color="textMuted">
            {data.visibility === 'private'
              ? 'Seu clube é privado: só entra quem tem o código. Gere outro e o antigo para de funcionar.'
              : 'Gere outro código e o antigo para de funcionar. Quem já entrou continua no clube.'}
          </Text>
          {regenerate.isError ? (
            <InlineMessage tone="error" message="Não foi possível gerar outro código agora." />
          ) : null}
          <Button
            label="Gerar novo código"
            icon="autorenew"
            variant="secondary"
            size="md"
            loading={regenerate.isPending}
            onPress={confirmRegenerate}
          />
        </Raised>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
          borderRadius: 22,
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.purpleLight,
          backgroundColor: theme.colors.primarySoft,
        }}
      >
        <Icon name="shield" size={22} color="accentText" />
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text variant="label">Como funciona para quem entra?</Text>
          <Text variant="bodySm" color="textMuted">
            Ao aceitar o convite, o Bubo cobre os debates e enquetes que falam de páginas além da
            página atual de cada membro. Convidar amigos é seguro e sem spoilers!
          </Text>
        </View>
      </View>
    </FormScreen>
  );
}
