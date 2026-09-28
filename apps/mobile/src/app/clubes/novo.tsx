import { CLUB_DESCRIPTION_MAX, CLUB_NAME_MAX, type ClubIcon } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  BookCover,
  BuboMascot,
  Button,
  Card,
  FormScreen,
  Icon,
  InlineMessage,
  SectionHeader,
  Text,
  TextField,
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

/** Radio pill used for the icon and the weekly goal (same look as Você → Aparência). */
function Choice({
  label,
  selected,
  onPress,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touchTarget,
        minWidth: theme.sizes.touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.pill,
        borderWidth: theme.sizes.borderWidth,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
      }}
    >
      {children}
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
  const [entryId, setEntryId] = useState<string | null>(null);
  const [goal, setGoal] = useState<50 | 75 | 100 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalogEntries = (shelf.data?.entries ?? []).filter((entry) => entry.book.catalogId);

  async function submit() {
    if (name.trim().length < 3) {
      setError('Dê um nome com pelo menos 3 letras ao clube.');
      return;
    }
    if (!entryId) {
      setError('Escolha o livro que o clube vai ler.');
      return;
    }
    setError(null);
    try {
      const club = await create.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        icon,
        shelfEntryId: entryId,
        weeklyGoalPages: goal,
      });
      haptics.success();
      router.replace({ pathname: '/clubes/[id]', params: { id: club.id } });
    } catch (e) {
      haptics.error();
      setError(
        e instanceof ApiError && e.code === 'CONFLICT'
          ? 'Você já criou o máximo de 5 clubes. Exclua um para abrir outro.'
          : e instanceof ApiError && e.code === 'VALIDATION_FAILED'
            ? 'Confira os campos. O livro precisa ter vindo do catálogo.'
            : 'Não foi possível criar o clube agora.',
      );
    }
  }

  return (
    <FormScreen
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
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BuboMascot state="emptyCommunity" size={72} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="caption" color="accentText">
              Dica do Bubo
            </Text>
            <Text variant="bodySm">
              Uma meta semanal de páginas ajuda todo mundo a chegar junto nos mesmos debates.
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader title="1. Identidade e proposta" icon="badge" />
        <TextField
          label="Nome do clube"
          placeholder="Ex.: Círculo de Ficção Científica"
          value={name}
          onChangeText={setName}
          maxLength={CLUB_NAME_MAX}
          hint={`Até ${CLUB_NAME_MAX} caracteres`}
        />
        <TextField
          label="Proposta (opcional)"
          placeholder="O que vocês vão debater?"
          value={description}
          onChangeText={setDescription}
          maxLength={CLUB_DESCRIPTION_MAX}
          multiline
          textAlignVertical="top"
        />
        <Text variant="label">Ícone do clube</Text>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
        >
          {CLUB_ICON_ORDER.map((option) => (
            <Choice
              key={option}
              label={`Ícone ${CLUB_ICON_META[option].label}`}
              selected={icon === option}
              onPress={() => setIcon(option)}
            >
              <Icon
                name={CLUB_ICON_META[option].icon}
                size={24}
                color={icon === option ? 'accentText' : 'textMuted'}
              />
            </Choice>
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeader title="2. Obra do clube" icon="menu-book" />
        {shelf.isPending ? (
          <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando estante" />
        ) : catalogEntries.length === 0 ? (
          <>
            <Text variant="body" color="textMuted">
              O clube lê um livro do catálogo, para que todos os membros tenham a mesma edição e as
              mesmas páginas. Adicione um pela busca e volte aqui.
            </Text>
            <Button
              label="Descobrir livros"
              icon="search"
              variant="secondary"
              size="md"
              onPress={() => router.push('/descobrir')}
            />
          </>
        ) : (
          <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
            {catalogEntries.map((entry) => {
              const selected = entry.id === entryId;
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${entry.book.title}${entry.book.author ? `, de ${entry.book.author}` : ''}`}
                  onPress={() => {
                    haptics.selection();
                    setEntryId(entry.id);
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
                    title={entry.book.title}
                    author={entry.book.author}
                    coverUrls={entry.book.coverUrls}
                    width={44}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={2}>
                      {entry.book.title}
                    </Text>
                    <Text variant="bodySm" color="textMuted" numberOfLines={1}>
                      {[
                        entry.book.author,
                        entry.book.totalPages ? `${entry.book.totalPages} págs.` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
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
          </View>
        )}
        <Text variant="label">Meta de ritmo coletivo</Text>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
        >
          {WEEKLY_GOAL_CHOICES.map((option) => (
            <Choice
              key={option.label}
              label={option.value ? `${option.label} por semana` : option.label}
              selected={goal === option.value}
              onPress={() => setGoal(option.value)}
            >
              <Text variant="label" color={goal === option.value ? 'accentText' : 'text'}>
                {option.label}
              </Text>
            </Choice>
          ))}
        </View>
      </Card>

      <Card tone="muted">
        <SectionHeader title="3. Blindagem e acesso" icon="shield" />
        <Text variant="bodySm" color="textMuted">
          A blindagem anti-spoiler é sempre ativa: todo debate declara a página de que fala, e quem
          ainda não chegou lá vê só um aviso.
        </Text>
        <Text variant="bodySm" color="textMuted">
          Por enquanto todo clube é público: qualquer leitor pode entrar aceitando as diretrizes.
          Clubes privados com convite chegam depois.
        </Text>
      </Card>
    </FormScreen>
  );
}
