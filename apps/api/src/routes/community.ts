import {
  API_ROUTES,
  blockRequestSchema,
  createClubRequestSchema,
  createPostRequestSchema,
  createReplyRequestSchema,
  joinClubRequestSchema,
  moderationRequestSchema,
  reportRequestSchema,
} from '@bubo/contracts';
import { type Context, Hono } from 'hono';

import { type AppEnv } from '../env';
import { createRateLimiter } from '../lib/rate-limit';
import { parseJsonBody } from '../lib/validation';
import {
  blockUser,
  createClub,
  createPost,
  createReply,
  deleteClub,
  deleteContent,
  getClub,
  getTopic,
  joinClub,
  leaveClub,
  listBlocks,
  listClubs,
  listPosts,
  moderate,
  reportContent,
  unblockUser,
} from '../services/community';

const readerId = (c: Context<AppEnv>) => c.get('session').user.id;

/**
 * Comunidade (Task 07): clubs, anti-spoiler debates, reports and blocks. Session-protected;
 * membership, spoiler locks and moderation are enforced in the service, never in the client.
 */
export function communityRoutes(deps: { now: () => Date }) {
  const routes = new Hono<AppEnv>();
  // Writes only (clubs, topics, replies, reports): a flood guard per reader, not a quota.
  const writes = createRateLimiter({
    limit: 30,
    windowMs: 60_000,
    now: () => deps.now().getTime(),
    message: 'Too many posts in a short time. Try again in a moment.',
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

  routes.get(API_ROUTES.club, async (c) =>
    c.json(await getClub(c.get('db'), readerId(c), c.req.param('id'))),
  );

  routes.delete(API_ROUTES.club, async (c) => {
    await deleteClub(c.get('db'), readerId(c), c.req.param('id'));
    return c.json({ deleted: true as const });
  });

  routes.put(API_ROUTES.clubMembership, async (c) => {
    await parseJsonBody(c, joinClubRequestSchema);
    return c.json(await joinClub(c.get('db'), readerId(c), c.req.param('id')));
  });

  routes.delete(API_ROUTES.clubMembership, async (c) => {
    await leaveClub(c.get('db'), readerId(c), c.req.param('id'));
    return c.json({ deleted: true as const });
  });

  routes.get(API_ROUTES.clubPosts, async (c) =>
    c.json(await listPosts(c.get('db'), readerId(c), c.req.param('id'))),
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

  return routes;
}
