import { z } from 'zod';
import { createCycleRequestSchema, clubCyclesResponseSchema } from './cycles';
import { markNotificationsReadSchema, notificationsResponseSchema } from './notifications';
import {
  pushTokenRequestSchema,
  pushTokenResponseSchema,
  readerPreferencesSchema,
} from './preferences';
import {
  friendActionSchema,
  friendsResponseSchema,
  friendsFeedSchema,
  socialPreferencesSchema,
} from './friends';

import { achievementsResponseSchema } from './achievements';
import { leagueResponseSchema } from './league';
import {
  blockRequestSchema,
  blocksResponseSchema,
  clubDetailSchema,
  clubMembersResponseSchema,
  clubPollDetailSchema,
  clubPollSchema,
  clubPollsResponseSchema,
  communityFeedResponseSchema,
  createPollRequestSchema,
  inviteCodeResponseSchema,
  invitePreviewSchema,
  joinByCodeRequestSchema,
  pollArgumentRequestSchema,
  pollArgumentSchema,
  pollVoteRequestSchema,
  reactionRequestSchema,
  reactionResponseSchema,
  clubPostSchema,
  clubPostsResponseSchema,
  clubReplySchema,
  clubsResponseSchema,
  clubTopicResponseSchema,
  createClubRequestSchema,
  createPostRequestSchema,
  createReplyRequestSchema,
  joinClubRequestSchema,
  moderationRequestSchema,
  moderationResponseSchema,
  reportRequestSchema,
  reportResponseSchema,
  moderationQueueSchema,
  globalModerationRequestSchema,
} from './community';
import {
  catalogBookResponseSchema,
  catalogDiscoverResponseSchema,
  catalogSearchResponseSchema,
} from './catalog';
import { errorResponseSchema } from './errors';
import { assessSessionRequestSchema, assessSessionResponseSchema } from './session-assessment';
import { memoryStatsResponseSchema } from './memory';
import { replayResponseSchema } from './replay';
import { healthResponseSchema, readyResponseSchema } from './health';
import {
  meResponseSchema,
  onboardingRequestSchema,
  shelfEntrySchema,
  shelfResponseSchema,
} from './me';
import {
  createCardRequestSchema,
  dueCardsResponseSchema,
  practiceCardsResponseSchema,
  recallCardSchema,
  reviewRequestSchema,
} from './recall';
import {
  addBookRequestSchema,
  createSessionRequestSchema,
  reviewResultSchema,
  sessionResultSchema,
  bookCommunitySchema,
  shelfEntryDetailSchema,
  statsResponseSchema,
  updateShelfEntryRequestSchema,
} from './shelf';

export const deleteResponseSchema = z.object({ deleted: z.literal(true) });

/** Paths relative to the `/v1` prefix. */
export const API_ROUTES = {
  health: '/health',
  ready: '/ready',
  openapi: '/openapi.json',
  /** Better Auth handler (sign-up, sign-in, sign-out, session, password reset). */
  auth: '/auth',
  me: '/me',
  onboarding: '/me/onboarding',
  stats: '/me/stats',
  memoryStats: '/me/memory',
  achievements: '/me/achievements',
  league: '/me/league',
  replay: '/me/replay',
  shelf: '/shelf',
  shelfEntry: '/shelf/:id',
  shelfCommunity: '/shelf/:id/community',
  sessions: '/sessions',
  sessionAssessment: '/sessions/assessment',
  recallDue: '/recall/due',
  recallPractice: '/recall/practice',
  recallCards: '/recall/cards',
  recallCard: '/recall/cards/:id',
  recallReview: '/recall/cards/:id/review',
  catalogSearch: '/catalog/search',
  catalogBook: '/catalog/books/:catalogId',
  catalogIsbn: '/catalog/isbn/:isbn',
  catalogDiscover: '/catalog/discover',
  clubs: '/clubs',
  club: '/clubs/:id',
  clubMembership: '/clubs/:id/membership',
  clubPosts: '/clubs/:id/posts',
  clubPost: '/clubs/:id/posts/:postId',
  clubReplies: '/clubs/:id/posts/:postId/replies',
  clubReply: '/clubs/:id/replies/:replyId',
  clubModeration: '/clubs/:id/moderation',
  reports: '/reports',
  blocks: '/blocks',
  block: '/blocks/:userId',
  clubsJoin: '/clubs/join',
  clubInvite: '/clubs/invite/:code',
  clubInviteCode: '/clubs/:id/invite-code',
  clubMembers: '/clubs/:id/members',
  clubCycles: '/clubs/:id/cycles',
  clubCycleClose: '/clubs/:id/cycles/:cycleId/close',
  clubPolls: '/clubs/:id/polls',
  clubPoll: '/clubs/:id/polls/:pollId',
  clubPollVote: '/clubs/:id/polls/:pollId/vote',
  clubPollArgument: '/clubs/:id/polls/:pollId/argument',
  reactions: '/reactions',
  communityFeed: '/community/feed',
  friends: '/community/friends',
  friend: '/community/friends/:userId',
  friendsFeed: '/community/friends-feed',
  socialPreferences: '/me/social-preferences',
  moderationQueue: '/me/moderation',
  preferences: '/me/preferences',
  pushToken: '/me/push-token',
  pushTokenItem: '/me/push-token/:token',
  notifications: '/notifications',
  notificationsRead: '/notifications/read',
  /** Signed one-click opt-out link carried by every optional e-mail (ADR-038). */
  emailUnsubscribe: '/email/unsubscribe',
  /** Small content-hashed PNGs shown inside e-mails, public and cacheable forever (ADR-041). */
  emailArt: '/email/art/:file',
  /** Better Auth account deletion lives at /v1/auth/delete-user (documented, not in the registry). */
} as const;

/** POST /v1/email/unsubscribe?token= — the GET form answers an HTML confirmation page instead. */
export const emailUnsubscribeResponseSchema = z.object({ unsubscribed: z.literal(true) });
export type EmailUnsubscribeResponse = z.infer<typeof emailUnsubscribeResponseSchema>;

/** Fills `:param` placeholders, e.g. `apiPath(API_ROUTES.shelfEntry, { id })`. */
export function apiPath(template: string, params: Record<string, string>): string {
  return template.replace(/:(\w+)/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Missing route param "${key}" for ${template}`);
    return encodeURIComponent(value);
  });
}

export type ApiRouteDefinition = {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  tags: string[];
  /** Requires a Better Auth session cookie. */
  auth: boolean;
  requestBody?: z.ZodType;
  responses: Record<
    number,
    {
      description: string;
      schema: z.ZodType;
      /** Defaults to JSON; `text/html` is a browser page, `image/png` an e-mail picture. */
      contentType?: 'application/json' | 'text/html' | 'image/png';
    }
  >;
};

/** Registry used to generate the OpenAPI document. Add every new route here. */
export const API_ROUTE_DEFINITIONS: ApiRouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.replay,
    summary:
      'Private monthly or annual Replay from accepted reading sessions. Query: kind (month|year), year, month (monthly only), timeZone (IANA). Future periods are rejected.',
    tags: ['me'],
    auth: true,
    responses: {
      200: {
        description: 'Reading Replay with explicit history coverage.',
        schema: replayResponseSchema,
      },
      422: { description: 'Invalid or future period/timezone.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.memoryStats,
    summary:
      'Recorded review self-assessments by day, book, time of day and actual delay between reviews. Query: today, days (7|30|90|365), tz (UTC offset minutes).',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'Review history.', schema: memoryStatsResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.achievements,
    summary: 'Cognitive level and achievements derived from recorded activity. Query: today.',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'Achievements.', schema: achievementsResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.league,
    summary:
      'Weekly friends league: real weekly XP of the reader and sharing friends, rank and rank up to yesterday. Query: today.',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'League standings.', schema: leagueResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.health,
    summary: 'Liveness probe (no database access).',
    tags: ['system'],
    auth: false,
    responses: { 200: { description: 'Service is alive.', schema: healthResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.ready,
    summary: 'Readiness probe (configuration + database connectivity).',
    tags: ['system'],
    auth: false,
    responses: {
      200: { description: 'Ready to serve traffic.', schema: readyResponseSchema },
      503: { description: 'A dependency is not ready.', schema: readyResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.me,
    summary: 'The signed-in reader and onboarding state.',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'Current reader.', schema: meResponseSchema } },
  },
  {
    method: 'put',
    path: API_ROUTES.onboarding,
    summary: 'Save onboarding answers (habit, goals, interests, optional first book).',
    tags: ['me'],
    auth: true,
    requestBody: onboardingRequestSchema,
    responses: { 200: { description: 'Onboarding completed.', schema: meResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.stats,
    summary: 'Reading stats from real sessions (XP, streak, this week). Query: today=YYYY-MM-DD.',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'Stats.', schema: statsResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.shelf,
    summary: "The reader's shelf.",
    tags: ['shelf'],
    auth: true,
    responses: { 200: { description: 'Shelf entries.', schema: shelfResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.shelf,
    summary: 'Add a book to the shelf: a catalog pick ({catalogId}) or a manual entry.',
    tags: ['shelf'],
    auth: true,
    requestBody: addBookRequestSchema,
    responses: {
      201: { description: 'Created.', schema: shelfEntrySchema },
      409: { description: 'The book is already on the shelf.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.shelfEntry,
    summary: 'One shelf entry with its recent reading sessions, recall cards and reviews.',
    tags: ['shelf'],
    auth: true,
    responses: { 200: { description: 'Entry.', schema: shelfEntryDetailSchema } },
  },
  {
    method: 'patch',
    path: API_ROUTES.shelfEntry,
    summary: 'Change status, current page, page count, the private rating or the reader marks.',
    tags: ['shelf'],
    auth: true,
    requestBody: updateShelfEntryRequestSchema,
    responses: { 200: { description: 'Updated entry.', schema: shelfEntrySchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.shelfEntry,
    summary: 'Remove a book from the shelf (and its sessions).',
    tags: ['shelf'],
    auth: true,
    responses: { 200: { description: 'Removed.', schema: deleteResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.shelfCommunity,
    summary:
      'Anonymous numbers of this shelf book across Bubo readers: readers by status, ratings in aggregate (5+), books also read. Never names.',
    tags: ['shelf'],
    auth: true,
    responses: { 200: { description: 'Community numbers.', schema: bookCommunitySchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.sessions,
    summary: 'Record a finished focused reading session (updates progress, XP, streak).',
    tags: ['sessions'],
    auth: true,
    requestBody: createSessionRequestSchema,
    responses: {
      201: {
        description: 'Session recorded after the recall checklist passes.',
        schema: sessionResultSchema,
      },
      200: { description: 'Already accepted session UUID.', schema: sessionResultSchema },
      422: {
        description: 'Timing, progress or recall exercise is incomplete.',
        schema: errorResponseSchema,
      },
    },
  },
  {
    method: 'post',
    path: API_ROUTES.sessionAssessment,
    summary:
      'Assess a closed-book writing checklist. Optional Gemini question with explicit consent; no book accuracy verification.',
    tags: ['sessions'],
    auth: true,
    requestBody: assessSessionRequestSchema,
    responses: {
      200: { description: 'Checklist and optional coach.', schema: assessSessionResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.recallDue,
    summary: 'Recall cards due today or earlier. Query: today=YYYY-MM-DD.',
    tags: ['recall'],
    auth: true,
    responses: { 200: { description: 'Due cards.', schema: dueCardsResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.recallPractice,
    summary:
      'Practice decks: cards that slipped and the 60-second round. Practising never grades, reschedules or awards XP. Query: today=YYYY-MM-DD.',
    tags: ['recall'],
    auth: true,
    responses: { 200: { description: 'Practice decks.', schema: practiceCardsResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.recallCards,
    summary: 'Create a recall card for a book on the shelf.',
    tags: ['recall'],
    auth: true,
    requestBody: createCardRequestSchema,
    responses: { 201: { description: 'Created.', schema: recallCardSchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.recallCard,
    summary: 'Delete a recall card.',
    tags: ['recall'],
    auth: true,
    responses: { 200: { description: 'Deleted.', schema: deleteResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.recallReview,
    summary: 'Grade a recall attempt (SM-2 reschedules the card). Idempotent on id.',
    tags: ['recall'],
    auth: true,
    requestBody: reviewRequestSchema,
    responses: {
      201: { description: 'Review recorded.', schema: reviewResultSchema },
      200: { description: 'Retry of an already recorded review.', schema: reviewResultSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.catalogSearch,
    summary: 'Search Google Books + Open Library (merged, de-duplicated). Query: q, limit.',
    tags: ['catalog'],
    auth: true,
    responses: {
      200: {
        description: 'Results (possibly partial, see sources).',
        schema: catalogSearchResponseSchema,
      },
      503: {
        description: 'No usable results and at least one catalog source failed.',
        schema: errorResponseSchema,
      },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.catalogDiscover,
    summary:
      'Discover sections: taste-graph recommendations from the shelf and interests, most read in Bubo and in Portuguese. Query: genre.',
    tags: ['catalog'],
    auth: true,
    responses: {
      200: {
        description: 'Sections (possibly fewer when Open Library is unavailable, see sources).',
        schema: catalogDiscoverResponseSchema,
      },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.catalogBook,
    summary: 'One catalog book (details + cover candidates) and whether it is on the shelf.',
    tags: ['catalog'],
    auth: true,
    responses: {
      200: { description: 'Book.', schema: catalogBookResponseSchema },
      404: { description: 'Unknown catalog id.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.catalogIsbn,
    summary: 'Look up a book by ISBN-10/13 (barcode scanner).',
    tags: ['catalog'],
    auth: true,
    responses: {
      200: { description: 'Book.', schema: catalogBookResponseSchema },
      404: { description: 'No book with this ISBN.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.clubs,
    summary: "The reader's clubs and public clubs to discover. Query: q (name or book title).",
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Clubs.', schema: clubsResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.clubs,
    summary: "Create a club around a catalog book from the creator's shelf (creator = owner).",
    tags: ['community'],
    auth: true,
    requestBody: createClubRequestSchema,
    responses: {
      201: { description: 'Created.', schema: clubDetailSchema },
      409: { description: 'Club limit reached.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.club,
    summary: "One club, the reader's membership and page on its book.",
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Club.', schema: clubDetailSchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.club,
    summary: 'Delete a club and all its content (owner only).',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Deleted.', schema: deleteResponseSchema } },
  },
  {
    method: 'put',
    path: API_ROUTES.clubMembership,
    summary: 'Join (accepting the guidelines); adds the book to the shelf if missing. Idempotent.',
    tags: ['community'],
    auth: true,
    requestBody: joinClubRequestSchema,
    responses: { 200: { description: 'Joined.', schema: clubDetailSchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.clubMembership,
    summary: 'Leave a club (the owner deletes it instead).',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Left.', schema: deleteResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.clubPosts,
    summary:
      "Debates and book reviews (members only); query reviews=1 filters reviews before the limit. Content beyond the reader's page is locked, including ratings.",
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Topics.', schema: clubPostsResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.clubPosts,
    summary:
      'Open a debate or book review (reviewRating 1–5, body 30+ characters, kind discussion). Idempotent on id.',
    tags: ['community'],
    auth: true,
    requestBody: createPostRequestSchema,
    responses: {
      201: { description: 'Created.', schema: clubPostSchema },
      200: { description: 'Retry of an existing topic.', schema: clubPostSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.clubPost,
    summary: 'One topic with its replies. Query: reveal=1 to see content beyond your page.',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Topic.', schema: clubTopicResponseSchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.clubPost,
    summary: 'Delete your topic, or remove one as the club owner.',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Deleted.', schema: deleteResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.clubReplies,
    summary: "Reply to a topic (page never below the topic's). Idempotent on id.",
    tags: ['community'],
    auth: true,
    requestBody: createReplyRequestSchema,
    responses: {
      201: { description: 'Created.', schema: clubReplySchema },
      200: { description: 'Retry of an existing reply.', schema: clubReplySchema },
    },
  },
  {
    method: 'delete',
    path: API_ROUTES.clubReply,
    summary: 'Delete your reply, or remove one as the club owner.',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Deleted.', schema: deleteResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.clubModeration,
    summary: 'Remove or restore a topic/reply (club owner). Resolves its open reports.',
    tags: ['community'],
    auth: true,
    requestBody: moderationRequestSchema,
    responses: { 200: { description: 'Moderated.', schema: moderationResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.reports,
    summary: 'Report a topic or reply. Idempotent per reader; 3 reports hide it for review.',
    tags: ['community'],
    auth: true,
    requestBody: reportRequestSchema,
    responses: { 200: { description: 'Reported.', schema: reportResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.blocks,
    summary: 'Readers you blocked.',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Blocks.', schema: blocksResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.blocks,
    summary: 'Block a reader: their topics and replies disappear for you. Idempotent.',
    tags: ['community'],
    auth: true,
    requestBody: blockRequestSchema,
    responses: { 200: { description: 'Blocked.', schema: blocksResponseSchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.block,
    summary: 'Unblock a reader.',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Unblocked.', schema: blocksResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.communityFeed,
    summary: "Newest topics and polls from the reader's clubs, spoiler-locked per club.",
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Feed.', schema: communityFeedResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.clubsJoin,
    summary: 'Join a club with an invite code (accepting the guidelines). Idempotent.',
    tags: ['community'],
    auth: true,
    requestBody: joinByCodeRequestSchema,
    responses: {
      200: { description: 'Joined.', schema: clubDetailSchema },
      404: { description: 'Unknown code.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.clubInvite,
    summary: 'What an invite code leads to, before joining.',
    tags: ['community'],
    auth: true,
    responses: {
      200: { description: 'Club preview.', schema: invitePreviewSchema },
      404: { description: 'Unknown code.', schema: errorResponseSchema },
    },
  },
  {
    method: 'post',
    path: API_ROUTES.clubInviteCode,
    summary: 'Replace the club invite code (owner). Old links stop working.',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'New code.', schema: inviteCodeResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.clubMembers,
    summary: 'Members, their page on the club book and the page distribution (members only).',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Members.', schema: clubMembersResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.clubPolls,
    summary: 'Club polls, newest first; spoiler-locked like topics (members only).',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Polls.', schema: clubPollsResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.clubPolls,
    summary: 'Create a poll (2–4 options, 3 or 7 days). Idempotent on id.',
    tags: ['community'],
    auth: true,
    requestBody: createPollRequestSchema,
    responses: {
      201: { description: 'Created.', schema: clubPollSchema },
      200: { description: 'Retry of an existing poll.', schema: clubPollSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.clubPoll,
    summary: 'One poll with its arguments. Query: reveal=1 to see it beyond your page.',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Poll.', schema: clubPollDetailSchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.clubPoll,
    summary: 'Delete your poll, or remove one as the club owner.',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Deleted.', schema: deleteResponseSchema } },
  },
  {
    method: 'put',
    path: API_ROUTES.clubPollVote,
    summary: "Replace the reader's vote while the poll is open.",
    tags: ['community'],
    auth: true,
    requestBody: pollVoteRequestSchema,
    responses: {
      200: { description: 'Poll with results.', schema: clubPollSchema },
      409: { description: 'Poll closed.', schema: errorResponseSchema },
    },
  },
  {
    method: 'put',
    path: API_ROUTES.clubPollArgument,
    summary: "Write or edit the reader's argument for their vote.",
    tags: ['community'],
    auth: true,
    requestBody: pollArgumentRequestSchema,
    responses: { 200: { description: 'Argument.', schema: pollArgumentSchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.clubPollArgument,
    summary: "Delete the reader's own argument.",
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Deleted.', schema: deleteResponseSchema } },
  },
  {
    method: 'put',
    path: API_ROUTES.reactions,
    summary: 'Turn a reaction (insight, idea, counterpoint) on or off on a topic or argument.',
    tags: ['community'],
    auth: true,
    requestBody: reactionRequestSchema,
    responses: { 200: { description: 'Counts.', schema: reactionResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.friends,
    summary: 'Friends, incoming/outgoing requests and privacy preferences.',
    tags: ['community'],
    auth: true,
    responses: {
      200: { description: 'Own relationships (up to 200).', schema: friendsResponseSchema },
    },
  },
  {
    method: 'put',
    path: API_ROUTES.friend,
    summary: 'Request a shared-club reader, accept incoming request or remove relationship.',
    tags: ['community'],
    auth: true,
    requestBody: friendActionSchema,
    responses: { 200: { description: 'Relationships.', schema: friendsResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.friendsFeed,
    summary:
      'Up to 50 catalog-book reading activities shared by accepted friends, after consent. Never reflections.',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Feed.', schema: friendsFeedSchema } },
  },
  {
    method: 'put',
    path: API_ROUTES.socialPreferences,
    summary: 'Own friendship and sharing preferences; sharing defaults off.',
    tags: ['me'],
    auth: true,
    requestBody: socialPreferencesSchema,
    responses: {
      200: { description: 'Preferences and relationships.', schema: friendsResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.clubCycles,
    summary: 'Recent reading cycles of the shared club book. Members only.',
    tags: ['community'],
    auth: true,
    responses: {
      200: {
        description: 'Cycles with session-derived progress.',
        schema: clubCyclesResponseSchema,
      },
    },
  },
  {
    method: 'post',
    path: API_ROUTES.clubCycles,
    summary: 'Start one cycle and snapshot participants (owner only, idempotent id).',
    tags: ['community'],
    auth: true,
    requestBody: createCycleRequestSchema,
    responses: { 200: { description: 'Cycles.', schema: clubCyclesResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.clubCycleClose,
    summary: 'Close a cycle (owner only, idempotent).',
    tags: ['community'],
    auth: true,
    responses: { 200: { description: 'Cycles.', schema: clubCyclesResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.moderationQueue,
    summary:
      'Open community reports, configured moderators only. Query reveal=1 explicitly includes reported text.',
    tags: ['community'],
    auth: true,
    responses: {
      200: { description: 'Queue (at most 100 items).', schema: moderationQueueSchema },
    },
  },
  {
    method: 'post',
    path: API_ROUTES.moderationQueue,
    summary: 'Resolve reported content across clubs, configured moderators only.',
    tags: ['community'],
    auth: true,
    requestBody: globalModerationRequestSchema,
    responses: { 200: { description: 'Moderated.', schema: moderationResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.preferences,
    summary: 'Cognitive and notification preferences (defaults until saved). Task 09.',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'Preferences.', schema: readerPreferencesSchema } },
  },
  {
    method: 'put',
    path: API_ROUTES.preferences,
    summary: 'Replace every preference (review rigor, daily limits, goals, reminders, pushes).',
    tags: ['me'],
    auth: true,
    requestBody: readerPreferencesSchema,
    responses: { 200: { description: 'Saved preferences.', schema: readerPreferencesSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.pushToken,
    summary: 'Register the Expo push token of this device (moves between accounts on it).',
    tags: ['me'],
    auth: true,
    requestBody: pushTokenRequestSchema,
    responses: { 200: { description: 'Registered.', schema: pushTokenResponseSchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.pushTokenItem,
    summary: 'Forget a push token of the reader (sign-out, notifications off).',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'Removed (idempotent).', schema: pushTokenResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.notifications,
    summary:
      'Inbox, newest 50: due reviews, replies to my topics, friend requests/acceptances, new club cycles.',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'Inbox.', schema: notificationsResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.notificationsRead,
    summary: 'Mark some notifications (ids) or all of them as read.',
    tags: ['me'],
    auth: true,
    requestBody: markNotificationsReadSchema,
    responses: { 200: { description: 'Inbox.', schema: notificationsResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.emailUnsubscribe,
    summary:
      'Opt out of optional Bubo e-mails from a signed link (query: token). Answers a small HTML page.',
    tags: ['email'],
    auth: false,
    responses: {
      200: { description: 'Confirmation page.', schema: z.string(), contentType: 'text/html' },
      400: { description: 'Invalid or tampered token.', schema: errorResponseSchema },
    },
  },
  {
    method: 'post',
    path: API_ROUTES.emailUnsubscribe,
    summary: 'One-click opt-out (RFC 8058 List-Unsubscribe-Post). Query: token.',
    tags: ['email'],
    auth: false,
    responses: {
      200: { description: 'Opted out.', schema: emailUnsubscribeResponseSchema },
      400: { description: 'Invalid or tampered token.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.emailArt,
    summary:
      'E-mail picture by content-hashed file name (Bubo pose in soft circles, logo). Public; cached for a year.',
    tags: ['email'],
    auth: false,
    responses: {
      200: { description: 'PNG bytes.', schema: z.string(), contentType: 'image/png' },
      404: { description: 'Unknown file.', schema: errorResponseSchema },
    },
  },
];
