import {
  MAX_BOOK_PAGES,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  REACTION_KINDS,
  TOPIC_KINDS,
} from '@bubo/domain';
import { z } from 'zod';

/** Comunidade: reading clubs with anti-spoiler debates (Task 07, ADR-019; Task 08, ADR-020). */

export const CLUB_ICONS = ['planet', 'classics', 'mind', 'spark', 'library', 'heart'] as const;
export const clubIconSchema = z.enum(CLUB_ICONS);
export type ClubIcon = z.infer<typeof clubIconSchema>;

export const WEEKLY_GOAL_OPTIONS = [50, 75, 100] as const;

export const CLUB_NAME_MAX = 60;
export const CLUB_DESCRIPTION_MAX = 500;
export const POST_TITLE_MAX = 120;
export const POST_BODY_MAX = 4000;
export const BOOK_REVIEW_MIN = 30;
export const POST_QUOTE_MAX = 500;
export const REPLY_BODY_MAX = 2000;
export const REPORT_DETAILS_MAX = 500;
export const POLL_QUESTION_MAX = 200;
export const POLL_OPTION_MAX = 120;
export const ARGUMENT_BODY_MAX = 1000;

const spoilerPageSchema = z.number().int().min(0).max(MAX_BOOK_PAGES);

export const clubVisibilitySchema = z.enum(['public', 'private']);
export type ClubVisibility = z.infer<typeof clubVisibilitySchema>;
export const topicKindSchema = z.enum(TOPIC_KINDS);
export const reactionKindSchema = z.enum(REACTION_KINDS);

export const clubBookSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  totalPages: z.number().int().positive().nullable(),
  coverUrls: z.array(z.string()),
});

export const clubMembershipSchema = z.enum(['owner', 'member']).nullable();

export const clubSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: clubIconSchema,
  book: clubBookSchema,
  weeklyGoalPages: z.number().int().positive().nullable(),
  visibility: clubVisibilitySchema,
  ownerName: z.string(),
  memberCount: z.number().int().nonnegative(),
  topicCount: z.number().int().nonnegative(),
  /** The signed-in reader's role, or null when not a member. */
  membership: clubMembershipSchema,
  /** The club's book is on the reader's shelf, and their page on it (Stitch "Na sua página!"). */
  onMyShelf: z.boolean(),
  myPage: z.number().int().nonnegative().nullable(),
  createdAt: z.iso.datetime(),
});
export type ClubSummary = z.infer<typeof clubSummarySchema>;

/** GET /v1/clubs?q= — clubs the reader belongs to, then public clubs to discover. */
export const clubsResponseSchema = z.object({
  mine: z.array(clubSummarySchema),
  discover: z.array(clubSummarySchema),
});
export type ClubsResponse = z.infer<typeof clubsResponseSchema>;

export const clubDetailSchema = clubSummarySchema.extend({
  /** The reader's page on the club's book (their shelf), or null when not a member. */
  readerPage: z.number().int().nonnegative().nullable(),
  /** Topics whose page the reader already reached (Stitch "Desbloqueou 8 dos 12 debates"). */
  unlockedTopicCount: z.number().int().nonnegative().nullable(),
  pollCount: z.number().int().nonnegative(),
  /** Open reports on this club's content — owner only, null for everyone else. */
  openReports: z.number().int().nonnegative().nullable(),
  /** Invite code for members to share (null for non-members). */
  inviteCode: z.string().nullable(),
  joinedAt: z.iso.datetime().nullable(),
});
export type ClubDetail = z.infer<typeof clubDetailSchema>;

/** POST /v1/clubs — the book comes from the creator's shelf and must be a catalog book. */
export const createClubRequestSchema = z.object({
  name: z.string().trim().min(3).max(CLUB_NAME_MAX),
  description: z.string().trim().max(CLUB_DESCRIPTION_MAX).default(''),
  icon: clubIconSchema,
  shelfEntryId: z.string().min(1),
  weeklyGoalPages: z
    .union([z.literal(50), z.literal(75), z.literal(100)])
    .nullable()
    .default(null),
  visibility: clubVisibilitySchema.default('public'),
});
export type CreateClubRequest = z.input<typeof createClubRequestSchema>;
export type CreateClubInput = z.output<typeof createClubRequestSchema>;

/** PUT /v1/clubs/:id/membership — joining means accepting the club guidelines. */
export const joinClubRequestSchema = z.object({ acceptGuidelines: z.literal(true) });
export type JoinClubRequest = z.infer<typeof joinClubRequestSchema>;

/** POST /v1/clubs/join — by invite code (private clubs, or a link shared by a member). */
export const joinByCodeRequestSchema = z.object({
  code: z.string().trim().min(8).max(200),
  acceptGuidelines: z.literal(true),
});
export type JoinByCodeRequest = z.infer<typeof joinByCodeRequestSchema>;

/** GET /v1/clubs/invite/:code — what an invite leads to, before joining. */
export const invitePreviewSchema = clubSummarySchema;
export const inviteCodeResponseSchema = z.object({ inviteCode: z.string() });

/** Author with their cognitive level from real XP (Stitch "Nív. 7"). */
export const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().positive(),
});

export const reactionCountsSchema = z.object({
  insight: z.number().int().nonnegative(),
  idea: z.number().int().nonnegative(),
  counterpoint: z.number().int().nonnegative(),
});
export type ReactionCounts = z.infer<typeof reactionCountsSchema>;

/**
 * `locked` = the content talks about a page beyond the reader's own; the server then sends no
 * title/body/quote at all. `moderation: 'hidden'` is only ever sent to the author and the owner.
 */
export const clubPostSchema = z.object({
  id: z.string(),
  author: authorSchema,
  kind: topicKindSchema,
  chapter: z.number().int().positive().nullable(),
  spoilerPage: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  replyCount: z.number().int().nonnegative(),
  isMine: z.boolean(),
  moderation: z.enum(['visible', 'hidden']),
  /** Open reports on this item — club owner only, null for everyone else. */
  openReportCount: z.number().int().nonnegative().nullable(),
  locked: z.boolean(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  quote: z.string().nullable(),
  /** A book review's rating; null on regular discussions or while spoiler-locked. */
  reviewRating: z.number().int().min(1).max(5).nullable().default(null),
  isBookReview: z.boolean().default(false),
  reactions: reactionCountsSchema,
  myReactions: z.array(reactionKindSchema),
});
export type ClubPost = z.infer<typeof clubPostSchema>;

export const clubReplySchema = z.object({
  id: z.string(),
  author: authorSchema,
  spoilerPage: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  isMine: z.boolean(),
  moderation: z.enum(['visible', 'hidden']),
  /** Open reports on this item — club owner only, null for everyone else. */
  openReportCount: z.number().int().nonnegative().nullable(),
  locked: z.boolean(),
  body: z.string().nullable(),
});
export type ClubReply = z.infer<typeof clubReplySchema>;

export const clubPostsResponseSchema = z.object({
  readerPage: z.number().int().nonnegative(),
  posts: z.array(clubPostSchema),
});
export type ClubPostsResponse = z.infer<typeof clubPostsResponseSchema>;

/** GET /v1/clubs/:id/posts/:postId?reveal=1 — `reveal` is the reader's explicit "espiar". */
export const clubTopicResponseSchema = z.object({
  readerPage: z.number().int().nonnegative(),
  revealed: z.boolean(),
  post: clubPostSchema,
  replies: z.array(clubReplySchema),
});
export type ClubTopicResponse = z.infer<typeof clubTopicResponseSchema>;

/** POST /v1/clubs/:id/posts — idempotent on the client-generated id. */
export const createPostRequestSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(3).max(POST_TITLE_MAX),
    body: z.string().trim().min(1).max(POST_BODY_MAX),
    spoilerPage: spoilerPageSchema,
    kind: topicKindSchema.default('discussion'),
    chapter: z.number().int().min(1).max(999).nullable().default(null),
    quote: z.string().trim().max(POST_QUOTE_MAX).nullable().default(null),
    reviewRating: z.number().int().min(1).max(5).nullable().default(null),
  })
  .refine(
    (input) =>
      input.reviewRating === null ||
      (input.kind === 'discussion' && input.body.length >= BOOK_REVIEW_MIN),
    {
      path: ['body'],
      message: 'Book reviews need at least 30 characters and kind discussion.',
    },
  );
export type CreatePostRequest = z.input<typeof createPostRequestSchema>;
export type CreatePostInput = z.output<typeof createPostRequestSchema>;

/** POST /v1/clubs/:id/posts/:postId/replies — never below the topic's own page. */
export const createReplyRequestSchema = z.object({
  id: z.uuid(),
  body: z.string().trim().min(1).max(REPLY_BODY_MAX),
  spoilerPage: spoilerPageSchema,
});
export type CreateReplyRequest = z.infer<typeof createReplyRequestSchema>;

// ---------------------------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------------------------

/** PUT /v1/reactions — turn one reaction on or off (idempotent). */
export const reactionRequestSchema = z.object({
  targetType: z.enum(['post', 'argument']),
  targetId: z.string().min(1),
  kind: reactionKindSchema,
  active: z.boolean(),
});
export type ReactionRequest = z.infer<typeof reactionRequestSchema>;
export const reactionResponseSchema = z.object({
  reactions: reactionCountsSchema,
  myReactions: z.array(reactionKindSchema),
});
export type ReactionResponse = z.infer<typeof reactionResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------------------------

export const pollOptionSchema = z.object({
  id: z.string(),
  /** Null while the poll is locked by the anti-spoiler. */
  label: z.string().nullable(),
  /** Null until results are visible (after voting, after closing, or for the author). */
  votes: z.number().int().nonnegative().nullable(),
  percent: z.number().int().min(0).max(100).nullable(),
  mine: z.boolean(),
});

export const clubPollSchema = z.object({
  id: z.string(),
  author: authorSchema,
  spoilerPage: z.number().int().nonnegative(),
  multiple: z.boolean(),
  createdAt: z.iso.datetime(),
  closesAt: z.iso.datetime(),
  isOpen: z.boolean(),
  isMine: z.boolean(),
  moderation: z.enum(['visible', 'hidden']),
  openReportCount: z.number().int().nonnegative().nullable(),
  locked: z.boolean(),
  question: z.string().nullable(),
  options: z.array(pollOptionSchema),
  totalVotes: z.number().int().nonnegative(),
  voterCount: z.number().int().nonnegative(),
  resultsVisible: z.boolean(),
  argumentCount: z.number().int().nonnegative(),
});
export type ClubPoll = z.infer<typeof clubPollSchema>;

export const clubPollsResponseSchema = z.object({
  readerPage: z.number().int().nonnegative(),
  polls: z.array(clubPollSchema),
});
export type ClubPollsResponse = z.infer<typeof clubPollsResponseSchema>;

export const pollArgumentSchema = z.object({
  id: z.string(),
  author: authorSchema,
  /** Labels of the options the author voted for (empty if they changed or removed the vote). */
  votedFor: z.array(z.string()),
  body: z.string().nullable(),
  createdAt: z.iso.datetime(),
  isMine: z.boolean(),
  moderation: z.enum(['visible', 'hidden']),
  openReportCount: z.number().int().nonnegative().nullable(),
  reactions: reactionCountsSchema,
  myReactions: z.array(reactionKindSchema),
});
export type PollArgument = z.infer<typeof pollArgumentSchema>;

/** GET /v1/clubs/:id/polls/:pollId?reveal=1 */
export const clubPollDetailSchema = z.object({
  readerPage: z.number().int().nonnegative(),
  revealed: z.boolean(),
  poll: clubPollSchema,
  arguments: z.array(pollArgumentSchema),
});
export type ClubPollDetail = z.infer<typeof clubPollDetailSchema>;

/** POST /v1/clubs/:id/polls — idempotent on the client-generated id. */
export const createPollRequestSchema = z
  .object({
    id: z.uuid(),
    question: z.string().trim().min(5).max(POLL_QUESTION_MAX),
    options: z
      .array(z.string().trim().min(1).max(POLL_OPTION_MAX))
      .min(POLL_MIN_OPTIONS)
      .max(POLL_MAX_OPTIONS),
    multiple: z.boolean().default(false),
    durationDays: z.union([z.literal(3), z.literal(7)]),
    spoilerPage: spoilerPageSchema,
  })
  .refine(
    (v) => new Set(v.options.map((o) => o.toLocaleLowerCase('pt-BR'))).size === v.options.length,
    { path: ['options'], message: 'Options must be different.' },
  );
export type CreatePollRequest = z.input<typeof createPollRequestSchema>;
export type CreatePollInput = z.output<typeof createPollRequestSchema>;

/** PUT /v1/clubs/:id/polls/:pollId/vote — replaces the reader's vote while the poll is open. */
export const pollVoteRequestSchema = z.object({
  optionIds: z.array(z.string().min(1)).min(1).max(POLL_MAX_OPTIONS),
});
export type PollVoteRequest = z.infer<typeof pollVoteRequestSchema>;

/** PUT /v1/clubs/:id/polls/:pollId/argument — the reader's single justification (upsert). */
export const pollArgumentRequestSchema = z.object({
  body: z.string().trim().min(1).max(ARGUMENT_BODY_MAX),
});
export type PollArgumentRequest = z.infer<typeof pollArgumentRequestSchema>;

// ---------------------------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------------------------

export const clubMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  role: z.enum(['owner', 'member']),
  level: z.number().int().positive(),
  levelTitle: z.string(),
  page: z.number().int().nonnegative(),
  percent: z.number().int().min(0).max(100).nullable(),
  isYou: z.boolean(),
  joinedAt: z.iso.datetime(),
});
export type ClubMember = z.infer<typeof clubMemberSchema>;

/** GET /v1/clubs/:id/members — members only; pages come from each member's own shelf. */
export const clubMembersResponseSchema = z.object({
  readerPage: z.number().int().nonnegative(),
  averagePercent: z.number().int().min(0).max(100).nullable(),
  distribution: z.array(
    z.object({
      from: z.number().int().positive(),
      to: z.number().int().positive(),
      count: z.number().int().nonnegative(),
    }),
  ),
  stats: z.object({
    memberCount: z.number().int().nonnegative(),
    pagesRead: z.number().int().nonnegative(),
    discussions: z.number().int().nonnegative(),
    pollVotes: z.number().int().nonnegative(),
  }),
  members: z.array(clubMemberSchema),
});
export type ClubMembersResponse = z.infer<typeof clubMembersResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------------------------

export const feedClubSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: clubIconSchema,
  bookTitle: z.string(),
  readerPage: z.number().int().nonnegative(),
});

export const feedItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('topic'), club: feedClubSchema, post: clubPostSchema }),
  z.object({ type: z.literal('poll'), club: feedClubSchema, poll: clubPollSchema }),
]);
export type FeedItem = z.infer<typeof feedItemSchema>;

/** GET /v1/community/feed — newest topics and polls from the reader's clubs, spoiler-locked. */
export const communityFeedResponseSchema = z.object({
  items: z.array(feedItemSchema),
  /** Topics and polls created in the last 24 h in the reader's clubs (Stitch "Radar dos clubes"). */
  newLast24h: z.number().int().nonnegative(),
});
export type CommunityFeedResponse = z.infer<typeof communityFeedResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Reports, moderation, blocks
// ---------------------------------------------------------------------------------------------

export const contentTargetSchema = z.object({
  targetType: z.enum(['post', 'reply', 'poll', 'argument']),
  targetId: z.string().min(1),
});

export const REPORT_REASONS = ['spoiler', 'offensive', 'spam', 'other'] as const;

/** POST /v1/reports — one report per reader and item; three distinct reports hide it. */
export const reportRequestSchema = contentTargetSchema.extend({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX).nullable().optional(),
});
export type ReportRequest = z.infer<typeof reportRequestSchema>;
export const reportResponseSchema = z.object({ reported: z.literal(true) });

/** POST /v1/clubs/:id/moderation — club owner only. */
export const moderationRequestSchema = contentTargetSchema.extend({
  action: z.enum(['remove', 'restore']),
});
export type ModerationRequest = z.infer<typeof moderationRequestSchema>;
export const moderationResponseSchema = z.object({
  status: z.enum(['visible', 'removed']),
});

export const globalModerationRequestSchema = moderationRequestSchema.extend({
  clubId: z.string().min(1),
});
export const moderationQueueSchema = z.object({
  items: z.array(
    contentTargetSchema.extend({
      clubId: z.string(),
      clubName: z.string(),
      reportCount: z.number().int().positive(),
      reasons: z.array(z.enum(REPORT_REASONS)),
      /** Only returned after an explicit reveal request by a configured moderator. */
      body: z.string().nullable(),
    }),
  ),
});
export type ModerationQueue = z.infer<typeof moderationQueueSchema>;
export type GlobalModerationRequest = z.infer<typeof globalModerationRequestSchema>;

export const blockRequestSchema = z.object({ userId: z.string().min(1) });
export type BlockRequest = z.infer<typeof blockRequestSchema>;
export const blocksResponseSchema = z.object({
  blocks: z.array(z.object({ userId: z.string(), name: z.string(), createdAt: z.iso.datetime() })),
});
export type BlocksResponse = z.infer<typeof blocksResponseSchema>;
