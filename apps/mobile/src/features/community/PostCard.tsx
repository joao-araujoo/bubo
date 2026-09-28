import { type ClubPost } from '@bubo/contracts';
import { Pressable, View } from 'react-native';

import { Avatar, Card, Chip, Icon, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { relativeTime } from './meta';
import { SpoilerLock } from './SpoilerLock';

/** Stitch "Tópicos do capítulo atual": page chip, author, text — or a spoiler lock. */
export function PostCard({
  post,
  readerPage,
  onOpen,
  onPeek,
}: {
  post: ClubPost;
  readerPage: number;
  onOpen: () => void;
  onPeek: () => void;
}) {
  const theme = useTheme();
  if (post.locked) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Avatar name={post.author.name} size={32} />
          <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
            {post.author.name}
          </Text>
          <Text variant="bodySm" color="textMuted">
            {relativeTime(post.createdAt)}
          </Text>
        </View>
        <SpoilerLock spoilerPage={post.spoilerPage} readerPage={readerPage} onPeek={onPeek} />
      </Card>
    );
  }
  const replies = post.replyCount === 1 ? '1 resposta' : `${post.replyCount} respostas`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Debate da página ${post.spoilerPage}, de ${post.author.name}: ${post.title ?? ''}. ${replies}.`}
      accessibilityHint="Abre o debate"
      onPress={() => {
        haptics.selection();
        onOpen();
      }}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Chip
            label={post.spoilerPage > 0 ? `Pág. ${post.spoilerPage}` : 'Geral'}
            tone="primary"
          />
          <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
            {post.isMine ? 'Você' : post.author.name}
          </Text>
          <Text variant="bodySm" color="textMuted">
            {relativeTime(post.createdAt)}
          </Text>
        </View>
        <Text variant="bodyStrong" numberOfLines={2}>
          {post.title}
        </Text>
        <Text variant="body" color="textMuted" numberOfLines={3}>
          {post.body}
        </Text>
        {post.moderation === 'hidden' ? (
          <Chip label="Oculto por denúncias" tone="orange" icon="flag" />
        ) : post.openReportCount ? (
          <Chip
            label={post.openReportCount === 1 ? '1 denúncia' : `${post.openReportCount} denúncias`}
            tone="orange"
            icon="flag"
          />
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Icon name="chat-bubble-outline" size={18} color="textMuted" />
          <Text variant="bodySm" color="textMuted">
            {replies}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
