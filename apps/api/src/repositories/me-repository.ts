import { database } from '../db';

type MeRow = {
  displayName: string;
  isPrivate: boolean;
  onboardingCompleted: boolean;
  theme: 'system' | 'light' | 'dark';
  reduceMotion: boolean;
  hapticsEnabled: boolean;
  soundsEnabled: boolean;
  pushEnabled: boolean;
  readingReminders: boolean;
  reviewReminders: boolean;
};

export async function readMe(databaseUrl: string, userId: string) {
  const sql = database(databaseUrl);

  const rows = await sql`
    select
      p.display_name as "displayName",
      p.is_private as "isPrivate",
      (p.onboarding_completed_at is not null) as "onboardingCompleted",
      s.theme as "theme",
      s.reduce_motion as "reduceMotion",
      s.haptics_enabled as "hapticsEnabled",
      s.sounds_enabled as "soundsEnabled",
      n.push_enabled as "pushEnabled",
      n.reading_reminders as "readingReminders",
      n.review_reminders as "reviewReminders"
    from profiles p
    join user_settings s on s.user_id = p.user_id
    join notification_preferences n on n.user_id = p.user_id
    where p.user_id = ${userId}
    limit 1
  `;

  const row = rows[0] as MeRow | undefined;
  if (!row) {
    throw new Error('Domain profile could not be loaded');
  }

  return row;
}
