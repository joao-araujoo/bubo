import { type ClubPost } from '@bubo/contracts';
import { type ReactionKind } from '@bubo/domain';
import { Pressable, View } from 'react-native';

import { Avatar, Icon, Pill, Raised, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { type ClubBadge } from './ClubBadge';
import { anchorLabel, ratingLabel, relativeTime, REVIEW_TAG_META, TOPIC_KIND_META } from './meta';
import { ReactionBar } from './ReactionBar';
import { SpoilerVeil } from './SpoilerVeil';
import { StarRating } from './StarRating';

type FeedClub = { name: string; icon: Parameters<typeof ClubBadge>[0]['icon']; bookTitle: string };

/** Status pill with Stitch priority: spoiler > discussion type > "Seguro para você". */
function StatusPill({ post, readerPage }: { post: ClubPost; readerPage: number }) {
  if (post.locked) {
    return (
      <Pill
        tone="error"
        icon="visibility-off"
        label={`Spoiler (+${Math.max(0, post.spoilerPage - readerPage)} págs)`}
      />
    );
  }
  if (post.isBookReview) return <Pill tone="gold" icon="edit-note" label="Resenha" />;
  if (post.kind !== 'discussion') {
    const meta = TOPIC_KIND_META[post.kind];
    return <Pill tone={meta.tone} icon={meta.icon} label={meta.label} />;
  }
  return <Pill tone="success" dot label="Seguro para você" />;
}

/**
 * Stitch forum topic card: author + level, time and anchor, status pill, title and excerpt,
 * reactions and replies. Locked topics show the lavender veil instead of any text.
 */
export function TopicCard({
  post,
  readerPage,
  onOpen,
  onReveal,
  onReact,
  club,
}: {
  post: ClubPost;
  readerPage: number;
  onOpen: () => void;
  onReveal: () => void;
  onReact?: (kind: ReactionKind, active: boolean) => void;
  /** Feed: which club the topic comes from. */
  club?: FeedClub;
}) {
  const theme = useTheme();
  const replies = post.replyCount === 1 ? '1 resposta' : `${post.replyCount} respostas`;
  const subtitle = [
    club ? club.name : null,
    relativeTime(post.createdAt),
    club ? null : anchorLabel(post.chapter, post.spoilerPage),
  ]
    .filter(Boolean)
    .join(' • ');

  const body = (
    <Raised
      faceColor={theme.colors.surface}
      borderColor={theme.colors.borderSoft}
      rimColor={theme.colors.cardShadow}
      radius={20}
      depth={theme.sizes.cardRim}
      faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Avatar name={post.author.name} size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
              {post.isMine ? 'Você' : post.author.name}
            </Text>
            <Pill label={`Nív. ${post.author.level}`} />
          </View>
          <Text variant="bodySm" color="textMuted" numberOfLines={1} style={{ fontSize: 12 }}>
            {subtitle}
          </Text>
        </View>
        {club ? (
          <Pill
            label={post.isBookReview ? 'Resenha' : TOPIC_KIND_META[post.kind].label}
            tone="primary"
          />
        ) : (
          <StatusPill post={post} readerPage={readerPage} />
        )}
      </View>

      {club ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: theme.spacing.sm,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <Icon name="bookmark-border" size={18} color="accentText" />
          <Text variant="bodySm" style={{ flex: 1 }} numberOfLines={1}>
            {`${club.bookTitle} • ${anchorLabel(post.chapter, post.spoilerPage)}`}
          </Text>
          {post.locked ? null : (
            <Pill
              tone="success"
              icon="check-circle-outline"
              label={`Sua página (p. ${readerPage})`}
            />
          )}
        </View>
      ) : null}

      {post.locked ? (
        <SpoilerVeil
          spoilerPage={post.spoilerPage}
          chapter={post.chapter}
          readerPage={readerPage}
          onReveal={onReveal}
        />
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="bodyStrong" style={{ fontSize: 16, lineHeight: 22 }}>
            {post.title}
          </Text>
          {post.reviewRating !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <StarRating value={post.reviewRating} size={14} />
              <Text variant="label" color="textMuted" style={{ fontSize: 12 }}>
                {ratingLabel(post.reviewRating)}
              </Text>
            </View>
          ) : null}
          {post.reviewTags.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {post.reviewTags.map((tag) => (
                <Pill key={tag} tone="neutral" label={REVIEW_TAG_META[tag].label} />
              ))}
            </View>
          ) : null}
          <Text variant="bodySm" color="textMuted" numberOfLines={3}>
            {post.quote ? `“${post.quote}” ` : ''}
            {post.body}
          </Text>
        </View>
      )}

      {post.moderation === 'hidden' ? (
        <Pill tone="warning" icon="flag" label="Oculto por denúncias" />
      ) : post.openReportCount ? (
        <Pill
          tone="warning"
          icon="flag"
          label={post.openReportCount === 1 ? '1 denúncia' : `${post.openReportCount} denúncias`}
        />
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSoft,
        }}
      >
        <View style={{ flex: 1 }}>
          <ReactionBar
            reactions={post.reactions}
            mine={post.myReactions}
            kinds={['insight', 'idea']}
            disabled={post.locked || post.isMine || !onReact}
            onToggle={onReact}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Icon
            name={post.locked ? 'lock-outline' : 'chat-bubble-outline'}
            size={18}
            color={post.locked ? 'textMuted' : 'accentText'}
          />
          <Text
            variant="label"
            color={post.locked ? 'textMuted' : 'accentText'}
            style={{ fontSize: 13 }}
          >
            {replies}
          </Text>
        </View>
      </View>
    </Raised>
  );

  if (post.locked) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${post.author.name}, ${anchorLabel(post.chapter, post.spoilerPage)}: ${post.title ?? ''}. ${replies}.`}
      accessibilityHint={post.isBookReview ? 'Abre a resenha' : 'Abre o debate'}
      onPress={() => {
        haptics.selection();
        onOpen();
      }}
    >
      {body}
    </Pressable>
  );
}
