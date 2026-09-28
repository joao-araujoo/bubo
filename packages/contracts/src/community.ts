import { MAX_BOOK_PAGES } from '@bubo/domain';
import { z } from 'zod';

/** Comunidade: reading clubs with anti-spoiler debates (Task 07, ADR-019). */

export const CLUB_ICONS = ['planet', 'classics', 'mind', 'spark', 'library', 'heart'] as const;
export const clubIconSchema = z.enum(CLUB_ICONS);
export type ClubIcon = z.infer<typeof clubIconSchema>;

export const WEEKLY_GOAL_OPTIONS = [50, 75, 100] as const;

export const CLUB_NAME_MAX = 60;
export const CLUB_DESCRIPTION_MAX = 500;
export const POST_TITLE_MAX = 120;
export const POST_BODY_MAX = 4000;
export const REPLY_BODY_MAX = 2000;
export const REPORT_DETAILS_MAX = 500;

const spoilerPageSchema = z.number().int().min(0).max(MAX_BOOK_PAGES);

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
  memberCount: z.number().int().nonnegative(),
  topicCount: z.number().int().nonnegative(),
  /** The signed-in reader's role, or null when not a member. */
  membership: clubMembershipSchema,
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
  /** Open reports on this club's content — owner only, null for everyone else. */
  openReports: z.number().int().nonnegative().nullable(),
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
});
export type CreateClubRequest = z.input<typeof createClubRequestSchema>;

/** PUT /v1/clubs/:id/membership — joining means accepting the club guidelines. */
export const joinClubRequestSchema = z.object({ acceptGuidelines: z.literal(true) });
export type JoinClubRequest = z.infer<typeof joinClubRequestSchema>;

export const authorSchema = z.object({ id: z.string(), name: z.string() });

/**
 * `locked` = the content talks about a page beyond the reader's own; the server then sends no
 * title/body at all. `moderation: 'hidden'` is only ever sent to the author and the club owner.
 */
export const clubPostSchema = z.object({
  id: z.string(),
  author: authorSchema,
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
export const createPostRequestSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(3).max(POST_TITLE_MAX),
  body: z.string().trim().min(1).max(POST_BODY_MAX),
  spoilerPage: spoilerPageSchema,
});
export type CreatePostRequest = z.infer<typeof createPostRequestSchema>;

/** POST /v1/clubs/:id/posts/:postId/replies — never below the topic's own page. */
export const createReplyRequestSchema = z.object({
  id: z.uuid(),
  body: z.string().trim().min(1).max(REPLY_BODY_MAX),
  spoilerPage: spoilerPageSchema,
});
export type CreateReplyRequest = z.infer<typeof createReplyRequestSchema>;

export const contentTargetSchema = z.object({
  targetType: z.enum(['post', 'reply']),
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

export const blockRequestSchema = z.object({ userId: z.string().min(1) });
export type BlockRequest = z.infer<typeof blockRequestSchema>;
export const blocksResponseSchema = z.object({
  blocks: z.array(z.object({ userId: z.string(), name: z.string(), createdAt: z.iso.datetime() })),
});
export type BlocksResponse = z.infer<typeof blocksResponseSchema>;
