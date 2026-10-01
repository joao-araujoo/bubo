import {
  CLUB_DESCRIPTION_MAX,
  CLUB_NAME_MAX,
  type ClubIcon,
  type ClubVisibility,
  type ShelfEntry,
} from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  BookCover,
  BottomSheet,
  BuboTip,
  Button,
  Card,
  FormScreen,
  Icon,
  IconTile,
  InlineMessage,
  Pill,
  type PillTone,
  Raised,
  TabChip,
  Text,
  TextField,
  Toggle,
} from '../../design-system';
import {
  CLUB_ICON_META,
  CLUB_ICON_ORDER,
  WEEKLY_GOAL_CHOICES,
} from '../../features/community/meta';
import { ApiError } from '../../lib/api/client';
import { useCreateClub, useShelf } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/** Stitch numbered section card header ("1. IDENTIDADE & PROPOSTA · Obrigatório"). */
function Section({
  number,
  title,
  icon,
  badge,
  badgeTone = 'primary',
  children,
}: {
  number: number;
  title: string;
  icon: ComponentProps<typeof Icon>['name'];
  badge: string;
  badgeTone?: PillTone;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderSoft,
        }}
      >
        <Icon name={icon} size={20} color="accentText" />
        <Text
          variant="caption"
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 13, letterSpacing: 0.9 }}
        >
          {`${number}. ${title}`}
        </Text>
        <Pill tone={badgeTone} label={badge} />
      </View>
      {children}
    </Card>
  );
}

/** Label row with a right-aligned hint (Stitch "Nome do clube* · Máx. 60 carac."). */
function FieldLabel({
  label,
  hint,
  required = false,
}: {
  label: string;
  hint?: string;
  required?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}>
      <Text variant="label" style={{ flex: 1 }}>
        {label}
        {required ? (
          <Text variant="label" color="accentText">
            {' *'}
          </Text>
        ) : null}
      </Text>
      {hint ? (
        <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Público / Privado radio card (Stitch "Blindagem & acesso"). */
function AccessCard({
  selected,
  icon,
  title,
  description,
  onPress,
}: {
  selected: boolean;
  icon: 'public' | 'lock-outline';
  title: string;
  description: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${description}`}
      style={{ flex: 1 }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={selected ? theme.colors.surfaceMuted : theme.colors.surface}
          borderColor={selected ? theme.colors.primary : theme.colors.border}
          rimColor={selected ? theme.colors.primaryRim : theme.colors.secondaryRim}
          radius={theme.radii.lg}
          depth={3}
          pressed={pressed}
          style={{ flexGrow: 1 }}
          faceStyle={{ flexGrow: 1, padding: theme.spacing.md, gap: theme.spacing.xs }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Icon name={icon} size={18} color={selected ? 'accentText' : 'textMuted'} />
            <Text variant="label" color={selected ? 'accentText' : 'text'} style={{ flex: 1 }}>
              {title}
            </Text>
            <Icon
              name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
              size={20}
              color={selected ? 'accentText' : 'textMuted'}
            />
          </View>
          <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
            {description}
          </Text>
        </Raised>
      )}
    </Pressable>
  );
}

/** Stitch `bubo_criar_novo_clube_de_leitura_mobile`, limited to what the API really does. */
export default function NewClubScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const shelf = useShelf(userId || undefined);
  const create = useCreateClub(userId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<ClubIcon>('planet');
  const [entry, setEntry] = useState<ShelfEntry | null>(null);
  const [picking, setPicking] = useState(false);
  const [goal, setGoal] = useState<50 | 75 | 100 | null>(75);
  const [visibility, setVisibility] = useState<ClubVisibility>('public');
  const [error, setError] = useState<string | null>(null);

  const catalogEntries = (shelf.data?.entries ?? []).filter((item) => item.book.catalogId);
  const chosen = entry ?? (catalogEntries.length === 1 ? (catalogEntries[0] ?? null) : null);

  async function submit() {
    if (name.trim().length < 3) {
      setError('Dê um nome com pelo menos 3 letras ao clube.');
      return;
    }
    if (!chosen) {
      setError('Escolha a obra que o clube vai ler.');
      return;
    }
    setError(null);
    try {
      const club = await create.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        icon,
        shelfEntryId: chosen.id,
        weeklyGoalPages: goal,
        visibility,
      });
      haptics.success();
      router.replace({ pathname: '/clubes/[id]', params: { id: club.id } });
    } catch (e) {
      haptics.error();
      setError(
        e instanceof ApiError && e.code === 'CONFLICT'
          ? 'Você já criou o máximo de 5 clubes. Exclua um para fundar outro.'
          : e instanceof ApiError && e.code === 'VALIDATION_FAILED'
            ? 'Confira os campos. A obra precisa ter vindo do catálogo.'
            : 'Não foi possível criar o clube agora.',
      );
    }
  }

  const bookLine = (item: ShelfEntry) =>
    [item.book.author, item.book.totalPages ? `${item.book.totalPages} págs.` : null]
      .filter(Boolean)
      .join(' • ');

  return (
    <FormScreen
      leading="close"
      title="Criar novo clube"
      eyebrow="Comunidade"
      footer={
        <>
          {error ? <InlineMessage tone="error" message={error} /> : null}
          <Button
            label="Fundar clube"
            icon="group-add"
            fullWidth
            loading={create.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <BuboTip state="profile" title="Dica do curador Bubo" titleIcon="tips-and-updates">
        Clubes com uma meta semanal de páginas ajudam todo mundo a chegar junto nos mesmos debates.
      </BuboTip>

      <Section number={1} title="Identidade & proposta" icon="badge" badge="Obrigatório">
        <View style={{ gap: theme.spacing.xs }}>
          <FieldLabel label="Nome do clube" hint={`Máx. ${CLUB_NAME_MAX} carac.`} required />
          <TextField
            label="Nome do clube"
            hideLabel
            placeholder="Ex.: Círculo de Ficção Científica & Filosofia"
            value={name}
            onChangeText={setName}
            maxLength={CLUB_NAME_MAX}
          />
        </View>
        <View style={{ gap: theme.spacing.xs }}>
          <FieldLabel label="Propósito literário" hint="O que vocês vão debater?" />
          <TextField
            label="Propósito literário"
            hideLabel
            placeholder="Leituras sobre futuros especulativos, dilemas éticos e a condição humana."
            value={description}
            onChangeText={setDescription}
            maxLength={CLUB_DESCRIPTION_MAX}
            multiline
            textAlignVertical="top"
          />
        </View>
        <Text variant="label">Ícone do clube (badge tátil)</Text>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
        >
          {CLUB_ICON_ORDER.map((option) => {
            const selected = icon === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Ícone ${CLUB_ICON_META[option].label}`}
                hitSlop={2}
                onPress={() => {
                  haptics.selection();
                  setIcon(option);
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: theme.radii.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: selected ? 3 : theme.sizes.borderWidth,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surfaceMuted,
                }}
              >
                <Icon
                  name={CLUB_ICON_META[option].icon}
                  size={24}
                  color={selected ? 'accentText' : 'textMuted'}
                />
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section
        number={2}
        title="Obra inaugural"
        icon="menu-book"
        badge="Blindagem ativa"
        badgeTone="success"
      >
        {shelf.isPending ? (
          <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando estante" />
        ) : catalogEntries.length === 0 ? (
          <>
            <Text variant="body" color="textMuted">
              O clube lê um livro do catálogo, para que todos tenham a mesma edição e as mesmas
              páginas. Adicione um pela busca e volte aqui.
            </Text>
            <Button
              label="Descobrir livros"
              icon="search"
              variant="secondary"
              size="md"
              onPress={() => router.push('/descobrir')}
            />
          </>
        ) : chosen ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderColor: theme.colors.primarySoft,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <BookCover
              title={chosen.book.title}
              author={chosen.book.author}
              coverUrls={chosen.book.coverUrls}
              width={52}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption" color="accentText">
                Obra escolhida
              </Text>
              <Text variant="bodyStrong" numberOfLines={2}>
                {chosen.book.title}
              </Text>
              <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                {bookLine(chosen)}
              </Text>
            </View>
            {catalogEntries.length > 1 ? (
              <Button
                label="Trocar"
                variant="secondary"
                size="md"
                compact
                onPress={() => setPicking(true)}
              />
            ) : null}
          </View>
        ) : (
          <Button
            label="Escolher obra da estante"
            icon="menu-book"
            variant="secondary"
            onPress={() => setPicking(true)}
          />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="label" style={{ flex: 1 }}>
            Meta de ritmo coletivo:
          </Text>
          <Text variant="label" color="accentText">
            {goal ? `${goal} páginas / semana` : 'Sem meta'}
          </Text>
        </View>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
        >
          {WEEKLY_GOAL_CHOICES.map((option) => (
            <TabChip
              key={option.value}
              role="radio"
              label={option.label}
              selected={goal === option.value}
              onPress={() => setGoal(goal === option.value ? null : option.value)}
            />
          ))}
        </View>
      </Section>

      <Section number={3} title="Blindagem & acesso" icon="shield" badge="Algoritmo Bubo">
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', gap: theme.spacing.sm }}
        >
          <AccessCard
            selected={visibility === 'public'}
            icon="public"
            title="Público"
            description="Qualquer leitor pode entrar e debater sob a blindagem automática."
            onPress={() => setVisibility('public')}
          />
          <AccessCard
            selected={visibility === 'private'}
            icon="lock-outline"
            title="Privado"
            description="Só entra quem recebe o link ou o código de convite."
            onPress={() => setVisibility('private')}
          />
        </View>
        <Toggle
          title="Blindagem obrigatória de página"
          description="Todo debate e enquete declara a página antes de ser publicado. Sempre ativa."
          value
          locked
        />
      </Section>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
          borderRadius: 22,
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.purpleLight,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <IconTile icon="verified-user" size={44} solid />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">Você será o Guardião Fundador</Text>
          <Text variant="bodySm" color="textMuted">
            Você modera os debates, revisa denúncias e compartilha o código de convite.
          </Text>
        </View>
      </View>

      <BottomSheet
        visible={picking}
        onClose={() => setPicking(false)}
        accessibilityLabel="Escolher obra"
      >
        <Text variant="titleSm" accessibilityRole="header">
          Escolha a obra do clube
        </Text>
        <Text variant="bodySm" color="textMuted">
          Só aparecem livros adicionados pelo catálogo.
        </Text>
        {catalogEntries.map((item) => {
          const selected = item.id === chosen?.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.book.title}${item.book.author ? `, de ${item.book.author}` : ''}`}
              onPress={() => {
                haptics.selection();
                setEntry(item);
                setPicking(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                padding: theme.spacing.sm,
                borderRadius: theme.radii.lg,
                borderWidth: theme.sizes.borderWidth,
                borderColor: selected ? theme.colors.primary : theme.colors.borderSoft,
                backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
              }}
            >
              <BookCover
                title={item.book.title}
                author={item.book.author}
                coverUrls={item.book.coverUrls}
                width={40}
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {item.book.title}
                </Text>
                <Text variant="bodySm" color="textMuted" numberOfLines={1}>
                  {bookLine(item)}
                </Text>
              </View>
              <Icon
                name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={22}
                color={selected ? 'accentText' : 'textMuted'}
              />
            </Pressable>
          );
        })}
      </BottomSheet>
    </FormScreen>
  );
}
