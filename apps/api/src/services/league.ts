import { type LeagueResponse, leagueResponseSchema } from '@bubo/contracts';
import { type Executor } from '@bubo/database';
import { buildLeagueStandings, leagueWeek } from '@bubo/domain';
import { sql } from 'drizzle-orm';

import { sharingFriends } from './friends';

/**
 * Weekly friends league (ADR-029): the reader plus accepted friends who share their activity.
 * XP is the real XP of the reader's week (sessions + reviews). A friend's XP only counts from
 * the moment both the friendship and their sharing began, like the friends feed (ADR-021).
 */
export async function getLeague(
  db: Executor,
  userId: string,
  today: string,
): Promise<LeagueResponse> {
  const { weekStart } = leagueWeek(today);
  const result = await db.execute(sql`
    WITH p AS (
      SELECT u.id, u.name, NULL::timestamptz AS since, true AS me FROM users u WHERE u.id = ${userId}
      UNION ALL
      SELECT fr.id, fr.name, greatest(fr.accepted_at, fr.sharing_since), false
      FROM (${sharingFriends(userId)}) fr
    ),
    xp AS (
      SELECT s.user_id, s.local_date, s.xp_earned AS xp
      FROM reading_sessions s JOIN p ON p.id = s.user_id
      WHERE s.local_date BETWEEN ${weekStart} AND ${today}
        AND (p.since IS NULL OR s.started_at >= p.since)
      UNION ALL
      SELECT r.user_id, r.local_date, r.xp_earned
      FROM review_logs r JOIN p ON p.id = r.user_id
      WHERE r.local_date BETWEEN ${weekStart} AND ${today}
        AND (p.since IS NULL OR r.reviewed_at >= p.since)
    )
    SELECT p.id, p.name, p.me,
      coalesce(sum(xp.xp) FILTER (WHERE xp.local_date < ${today}), 0)::int AS "xpBefore",
      coalesce(sum(xp.xp), 0)::int AS xp
    FROM p LEFT JOIN xp ON xp.user_id = p.id
    GROUP BY p.id, p.name, p.me
  `);
  const [prefs] = (
    await db.execute(
      sql`SELECT share_activity FROM reading_club_social_preferences WHERE user_id = ${userId}`,
    )
  ).rows;
  const standings = buildLeagueStandings({
    today,
    participants: result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      me: row.me === true,
      xpBefore: Number(row.xpBefore),
      xp: Number(row.xp),
    })),
  });
  return leagueResponseSchema.parse({
    today,
    sharing: prefs?.share_activity === true,
    ...standings,
  });
}
