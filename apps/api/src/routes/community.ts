import {
  API_ROUTES,
  createCycleRequestSchema,
  friendActionSchema,
  socialPreferencesSchema,
  blockRequestSchema,
  createClubRequestSchema,
  createPollRequestSchema,
  createPostRequestSchema,
  createReplyRequestSchema,
  joinByCodeRequestSchema,
  joinClubRequestSchema,
  moderationRequestSchema,
  pollArgumentRequestSchema,
  pollVoteRequestSchema,
  reactionRequestSchema,
  reportRequestSchema,
} from '@bubo/contracts';
import { type Context, Hono } from 'hono';

import { type AppEnv } from '../env';
import { type FetchLike } from '../services/catalog';
import { createRateLimiter } from '../lib/rate-limit';
import { parseJsonBody } from '../lib/validation';
import { listMembers } from '../services/club-members';
import {
  blockUser,
  createClub,
  createPost,
  createReply,
  deleteClub,
  deleteContent,
  getClub,
  getTopic,
  joinByCode,
  joinClub,
  leaveClub,
  listBlocks,
  listClubs,
  listPosts,
  moderate,
  previewInvite,
  regenerateInviteCode,
  reportContent,
  setReaction,
  unblockUser,
} from '../services/community';
import { getFeed } from '../services/community-feed';
import {
  notifyCycleStarted,
  notifyFriendAccepted,
  notifyFriendRequest,
  notifyTopicReply,
} from '../services/notifications';
import { type PushMessage, deliverPush } from '../services/push';
import { listCycles, startCycle, closeCycle } from '../services/club-cycles';
import { changeFriend, friendsFeed, listFriends, saveSocialPreferences } from '../services/friends';
import {
  createPoll,
  getPoll,
  listPolls,
  ownArgumentId,
  upsertArgument,
  votePoll,
} from '../services/polls';

const readerId = (c: Context<AppEnv>) => c.get('session').user.id;

/**
 * Comunidade (Tasks 07–08): clubs, anti-spoiler debates, polls, reactions, members, invites,
 * reports and blocks. Session-protected; membership, spoiler locks and moderation are enforced in
 * the services, never in the client.
 */
export function communityRoutes(deps: { now: () => Date; pushFetch: FetchLike }) {
  const routes = new Hono<AppEnv>();

  /**
   * Records the inbox item and pushes after the action succeeded. A failure here is logged and
   * never undoes or fails the action itself.
   */
  async function notify(c: Context<AppEnv>, build: () => Promise<PushMessage[]>) {
    try {
      const messages = await build();
      await deliverPush(c.get('db'), messages, { fetch: deps.pushFetch, logger: c.get('logger') });
    } catch (error) {
      c.get('logger').warn('notification failed', {
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  // Writes only (clubs, topics, replies, polls, votes, reports): a flood guard per reader.
  const writes = createRateLimiter({
    limit: 30,
    windowMs: 60_000,
    now: () => deps.now().getTime(),
    message: 'Too many posts in a short time. Try again in a moment.',
  });
  // Invite lookups: slows down code guessing (31^8 codes make it impractical anyway).
  const invites = createRateLimiter({
    limit: 20,
    windowMs: 60_000,
    now: () => deps.now().getTime(),
    message: 'Too many invite attempts. Try again in a moment.',
  });

  routes.get(API_ROUTES.clubs, async (c) =>
    c.json(await listClubs(c.get('db'), readerId(c), c.req.query('q') ?? '')),
  );

  routes.post(API_ROUTES.clubs, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, createClubRequestSchema);
    const club = await createClub(c.get('db'), readerId(c), input);
    c.get('logger').info('club created', { userId: readerId(c), clubId: club.id });
    return c.json(club, 201);
  });

  // Static segments before `/clubs/:id` so "join" and "invite" are never read as club ids.
  routes.post(API_ROUTES.clubsJoin, async (c) => {
    invites.hit(readerId(c));
    const input = await parseJsonBody(c, joinByCodeRequestSchema);
    return c.json(await joinByCode(c.get('db'), readerId(c), input.code));
  });

  routes.get(API_ROUTES.clubInvite, async (c) => {
    invites.hit(readerId(c));
    return c.json(await previewInvite(c.get('db'), readerId(c), c.req.param('code')));
  });

  routes.get(API_ROUTES.club, async (c) =>
    c.json(await getClub(c.get('db'), readerId(c), c.req.param('id'))),
  );

  routes.delete(API_ROUTES.club, async (c) => {
    await deleteClub(c.get('db'), readerId(c), c.req.param('id'));
    return c.json({ deleted: true as const });
  });

  routes.post(API_ROUTES.clubInviteCode, async (c) =>
    c.json(await regenerateInviteCode(c.get('db'), readerId(c), c.req.param('id'))),
  );

  routes.put(API_ROUTES.clubMembership, async (c) => {
    await parseJsonBody(c, joinClubRequestSchema);
    return c.json(await joinClub(c.get('db'), readerId(c), c.req.param('id')));
  });

  routes.delete(API_ROUTES.clubMembership, async (c) => {
    await leaveClub(c.get('db'), readerId(c), c.req.param('id'));
    return c.json({ deleted: true as const });
  });

  routes.get(API_ROUTES.clubMembers, async (c) =>
    c.json(await listMembers(c.get('db'), readerId(c), c.req.param('id'))),
  );

  routes.get(API_ROUTES.clubPosts, async (c) =>
    c.json(
      await listPosts(c.get('db'), readerId(c), c.req.param('id'), c.req.query('reviews') === '1'),
    ),
  );

  routes.post(API_ROUTES.clubPosts, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, createPostRequestSchema);
    const { post, created } = await createPost(c.get('db'), readerId(c), c.req.param('id'), input);
    return c.json(post, created ? 201 : 200);
  });

  routes.get(API_ROUTES.clubPost, async (c) =>
    c.json(
      await getTopic(
        c.get('db'),
        readerId(c),
        c.req.param('id'),
        c.req.param('postId'),
        c.req.query('reveal') === '1',
      ),
    ),
  );

  routes.delete(API_ROUTES.clubPost, async (c) => {
    await deleteContent(c.get('db'), readerId(c), c.req.param('id'), 'post', c.req.param('postId'));
    return c.json({ deleted: true as const });
  });

  routes.post(API_ROUTES.clubReplies, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, createReplyRequestSchema);
    const { reply, created } = await createReply(
      c.get('db'),
      readerId(c),
      c.req.param('id'),
      c.req.param('postId'),
      input,
    );
    if (created) {
      await notify(c, () =>
        notifyTopicReply(
          c.get('db'),
          { replierId: readerId(c), clubId: c.req.param('id'), postId: c.req.param('postId') },
          deps.now(),
        ),
      );
    }
    return c.json(reply, created ? 201 : 200);
  });

  routes.delete(API_ROUTES.clubReply, async (c) => {
    await deleteContent(
      c.get('db'),
      readerId(c),
      c.req.param('id'),
      'reply',
      c.req.param('replyId'),
    );
    return c.json({ deleted: true as const });
  });

  routes.get(API_ROUTES.clubPolls, async (c) =>
    c.json(await listPolls(c.get('db'), readerId(c), c.req.param('id'), deps.now())),
  );

  routes.post(API_ROUTES.clubPolls, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, createPollRequestSchema);
    const { poll, created } = await createPoll(
      c.get('db'),
      readerId(c),
      c.req.param('id'),
      input,
      deps.now(),
    );
    return c.json(poll, created ? 201 : 200);
  });

  routes.get(API_ROUTES.clubPoll, async (c) =>
    c.json(
      await getPoll(
        c.get('db'),
        readerId(c),
        c.req.param('id'),
        c.req.param('pollId'),
        c.req.query('reveal') === '1',
        deps.now(),
      ),
    ),
  );

  routes.delete(API_ROUTES.clubPoll, async (c) => {
    await deleteContent(c.get('db'), readerId(c), c.req.param('id'), 'poll', c.req.param('pollId'));
    return c.json({ deleted: true as const });
  });

  routes.put(API_ROUTES.clubPollVote, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, pollVoteRequestSchema);
    return c.json(
      await votePoll(
        c.get('db'),
        readerId(c),
        c.req.param('id'),
        c.req.param('pollId'),
        input.optionIds,
        deps.now(),
      ),
    );
  });

  routes.put(API_ROUTES.clubPollArgument, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, pollArgumentRequestSchema);
    return c.json(
      await upsertArgument(
        c.get('db'),
        readerId(c),
        c.req.param('id'),
        c.req.param('pollId'),
        input.body,
        deps.now(),
      ),
    );
  });

  routes.delete(API_ROUTES.clubPollArgument, async (c) => {
    const argumentId = await ownArgumentId(c.get('db'), readerId(c), c.req.param('pollId'));
    await deleteContent(c.get('db'), readerId(c), c.req.param('id'), 'argument', argumentId);
    return c.json({ deleted: true as const });
  });

  routes.put(API_ROUTES.reactions, async (c) => {
    const input = await parseJsonBody(c, reactionRequestSchema);
    return c.json(await setReaction(c.get('db'), readerId(c), input));
  });

  routes.get(API_ROUTES.communityFeed, async (c) =>
    c.json(await getFeed(c.get('db'), readerId(c), deps.now())),
  );

  routes.post(API_ROUTES.clubModeration, async (c) => {
    const input = await parseJsonBody(c, moderationRequestSchema);
    const result = await moderate(c.get('db'), readerId(c), c.req.param('id'), input);
    c.get('logger').info('club moderation', {
      userId: readerId(c),
      clubId: c.req.param('id'),
      targetType: input.targetType,
      action: input.action,
    });
    return c.json(result);
  });

  routes.post(API_ROUTES.reports, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, reportRequestSchema);
    const { created, hidden } = await reportContent(c.get('db'), readerId(c), input);
    // Ids and reason only: never the reported text or the reader's details.
    if (created) {
      c.get('logger').info('content reported', {
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        hidden,
      });
    }
    return c.json({ reported: true as const });
  });

  routes.get(API_ROUTES.blocks, async (c) => c.json(await listBlocks(c.get('db'), readerId(c))));

  routes.post(API_ROUTES.blocks, async (c) => {
    const input = await parseJsonBody(c, blockRequestSchema);
    return c.json(await blockUser(c.get('db'), readerId(c), input.userId));
  });

  routes.delete(API_ROUTES.block, async (c) =>
    c.json(await unblockUser(c.get('db'), readerId(c), c.req.param('userId'))),
  );

  // Friends (consented reading activity) and club reading cycles (Task 08).
  routes.get(API_ROUTES.friends, async (c) => c.json(await listFriends(c.get('db'), readerId(c))));
  routes.get(API_ROUTES.friendsFeed, async (c) =>
    c.json(await friendsFeed(c.get('db'), readerId(c))),
  );
  routes.put(API_ROUTES.friend, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, friendActionSchema);
    const otherId = c.req.param('userId');
    const { friends, event } = await changeFriend(
      c.get('db'),
      readerId(c),
      otherId,
      input.action,
      deps.now(),
    );
    if (event === 'requested') {
      await notify(c, () =>
        notifyFriendRequest(
          c.get('db'),
          { senderId: readerId(c), recipientId: otherId },
          deps.now(),
        ),
      );
    } else if (event === 'accepted') {
      await notify(c, () =>
        notifyFriendAccepted(
          c.get('db'),
          { senderId: otherId, recipientId: readerId(c) },
          deps.now(),
        ),
      );
    }
    return c.json(friends);
  });
  routes.put(API_ROUTES.socialPreferences, async (c) => {
    writes.hit(readerId(c));
    return c.json(
      await saveSocialPreferences(
        c.get('db'),
        readerId(c),
        await parseJsonBody(c, socialPreferencesSchema),
        deps.now(),
      ),
    );
  });
  routes.get(API_ROUTES.clubCycles, async (c) =>
    c.json(await listCycles(c.get('db'), readerId(c), c.req.param('id'), deps.now())),
  );
  routes.post(API_ROUTES.clubCycles, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, createCycleRequestSchema);
    const clubId = c.req.param('id');
    const { cycles, created } = await startCycle(
      c.get('db'),
      readerId(c),
      clubId,
      input,
      deps.now(),
    );
    if (created) {
      await notify(c, () =>
        notifyCycleStarted(
          c.get('db'),
          { ownerId: readerId(c), clubId, cycleId: input.id, goalPages: input.goalPages },
          deps.now(),
        ),
      );
    }
    return c.json(cycles);
  });
  routes.post(API_ROUTES.clubCycleClose, async (c) =>
    c.json(
      await closeCycle(
        c.get('db'),
        readerId(c),
        c.req.param('id'),
        c.req.param('cycleId'),
        deps.now(),
      ),
    ),
  );

  return routes;
}
