import { database } from '../db';

type AuthUser = {
  id: string;
  name: string;
};

export async function ensureDomainUser(
  databaseUrl: string,
  user: AuthUser,
) {
  const sql = database(databaseUrl);

  await sql.transaction([
    sql`
      insert into profiles (user_id, display_name)
      values (${user.id}, ${user.name})
      on conflict (user_id) do update
      set display_name = excluded.display_name
    `,
    sql`
      insert into user_settings (user_id)
      values (${user.id})
      on conflict (user_id) do nothing
    `,
    sql`
      insert into notification_preferences (user_id)
      values (${user.id})
      on conflict (user_id) do nothing
    `,
    sql`
      insert into onboarding_preferences (user_id)
      values (${user.id})
      on conflict (user_id) do nothing
    `,
  ]);
}
