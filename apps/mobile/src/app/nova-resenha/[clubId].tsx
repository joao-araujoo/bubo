import {
  BOOK_REVIEW_MIN,
  POST_BODY_MAX,
  POST_TITLE_MAX,
  createPostRequestSchema,
} from '@bubo/contracts';
import { MAX_BOOK_PAGES } from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  BookCover,
  Button,
  Card,
  EmptyState,
  FormScreen,
  InlineMessage,
  Stepper,
  Text,
  TextField,
  ToggleChip,
} from '../../design-system';
import { useClub, useCreateClubPost } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

export default function NewBookReviewScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const id = typeof clubId === 'string' ? clubId : '';
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const club = useClub(userId || undefined, id);
  const create = useCreateClubPost(userId, id);
  const uuid = useRef(Crypto.randomUUID());
  const submitting = useRef(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [page, setPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (club.isPending)
    return (
      <FormScreen title="Sua resenha">
        <ActivityIndicator accessibilityLabel="Carregando livro do clube" />
      </FormScreen>
    );
  if (club.isError)
    return (
      <FormScreen title="Sua resenha">
        <EmptyState
          mascot="offline"
          title="Não foi possível abrir o clube"
          description="Verifique sua conexão e seu acesso ao clube."
          action={<Button label="Tentar novamente" onPress={() => void club.refetch()} />}
        />
      </FormScreen>
    );
  const data = club.data;
  if (!data.membership)
    return (
      <FormScreen title="Sua resenha">
        <EmptyState
          mascot="emptyCommunity"
          title="Entre no clube para publicar"
          description="Resenhas são compartilhadas somente com os membros."
        />
      </FormScreen>
    );
  const pageText = page ?? String(data.readerPage ?? 0);
  async function publish() {
    if (submitting.current) return;
    const input = createPostRequestSchema.safeParse({
      id: uuid.current,
      title,
      body,
      reviewRating: rating,
      kind: 'discussion',
      spoilerPage: /^\d+$/.test(pageText) ? Number(pageText) : -1,
    });
    if (
      !input.success ||
      rating === null ||
      Number(pageText) > (data.book.totalPages ?? MAX_BOOK_PAGES)
    ) {
      setError(
        `Escolha uma nota de 1 a 5, um título de 3 ou mais caracteres, um texto de pelo menos ${BOOK_REVIEW_MIN} caracteres e uma página válida.`,
      );
      return;
    }
    submitting.current = true;
    setError(null);
    try {
      const review = await create.mutateAsync(input.data);
      haptics.success();
      router.replace({
        pathname: '/resenhas/[clubId]/[postId]',
        params: { clubId: id, postId: review.id },
      });
    } catch {
      setError('Não foi possível publicar. Sua resenha continua aqui para tentar novamente.');
      haptics.error();
    } finally {
      submitting.current = false;
    }
  }
  return (
    <FormScreen
      title="Sua resenha"
      eyebrow={data.name}
      footer={
        <Button
          label="Publicar no clube"
          icon="edit-note"
          loading={create.isPending}
          onPress={publish}
        />
      }
    >
      <Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <BookCover
            title={data.book.title}
            author={data.book.author}
            coverUrls={data.book.coverUrls}
            width={64}
          />
          <View style={{ flex: 1 }}>
            <Text variant="titleSm">{data.book.title}</Text>
            <Text variant="bodySm" color="textMuted">
              {data.book.author}
            </Text>
          </View>
        </View>
        <Text variant="bodySm">
          Sua experiência é pessoal. Conte o que ficou com você, sem precisar dar uma resposta
          certa.
        </Text>
      </Card>
      <Card>
        <Text variant="label">Sua nota para o livro</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Nota do livro"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <ToggleChip
              key={value}
              label={`${value}/5`}
              icon="star"
              selected={rating === value}
              onPress={() => {
                if (!create.isPending) setRating(value);
              }}
            />
          ))}
        </View>
        <TextField
          label="Título da resenha"
          value={title}
          onChangeText={setTitle}
          maxLength={POST_TITLE_MAX}
          editable={!create.isPending}
        />
        <TextField
          label="O que ficou com você?"
          value={body}
          onChangeText={setBody}
          maxLength={POST_BODY_MAX}
          multiline
          textAlignVertical="top"
          editable={!create.isPending}
          hint={`Pelo menos ${BOOK_REVIEW_MIN} caracteres. Use suas próprias palavras.`}
        />
        <Stepper
          label="Até que página a resenha conta?"
          value={pageText}
          onChangeText={(value) => {
            if (!create.isPending) setPage(value);
          }}
          max={data.book.totalPages ?? MAX_BOOK_PAGES}
        />
        <Text variant="bodySm" color="textMuted">
          Página 0 é uma resenha sem spoilers. Se comentar o final, informe a última página. Título,
          texto e nota ficam ocultos para quem ainda não chegou lá.
        </Text>
      </Card>
      <InlineMessage
        tone="info"
        message="Ao publicar, a resenha fica visível aos membros deste clube, conforme a página de cada leitor. Você pode apagá-la depois."
      />
      {error ? <InlineMessage tone="error" message={error} /> : null}
    </FormScreen>
  );
}
