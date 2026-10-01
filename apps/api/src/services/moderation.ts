import { moderationQueueSchema } from '@bubo/contracts';
import { type Executor } from '@bubo/database';
import { sql } from 'drizzle-orm';

/** Exact ids from server configuration only: no self-assigned role, e-mail or client flag. */
export function isModerator(userId: string, configuredIds: string | undefined): boolean {
  return (
    Boolean(userId) &&
    (configuredIds ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .includes(userId)
  );
}

/** No private reflections, sessions or unreported content enter this queue. */
export async function getModerationQueue(db: Executor, revealed: boolean) {
  const result = await db.execute(sql`
    SELECT r.target_type AS "targetType", r.target_id AS "targetId", r.club_id AS "clubId",
      c.name AS "clubName", count(*)::int AS "reportCount", array_agg(DISTINCT r.reason) AS reasons,
      CASE WHEN ${revealed} THEN max(content.body) ELSE NULL END AS body
    FROM reading_club_reports r JOIN reading_clubs c ON c.id = r.club_id
    JOIN (
      SELECT 'post' AS kind, id, club_id, status, title || E'\n' || body AS body FROM reading_club_posts
      UNION ALL SELECT 'reply', id, club_id, status, body FROM reading_club_replies
      UNION ALL SELECT 'poll', id, club_id, status, question FROM reading_club_polls
      UNION ALL SELECT 'argument', id, club_id, status, body FROM reading_club_poll_arguments
    ) content ON content.kind = r.target_type AND content.id = r.target_id AND content.club_id = r.club_id
    WHERE r.status = 'open' AND content.status <> 'removed'
    GROUP BY r.target_type, r.target_id, r.club_id, c.name
    ORDER BY min(r.created_at), r.target_id LIMIT 100
  `);
  return moderationQueueSchema.parse({ items: result.rows });
}
