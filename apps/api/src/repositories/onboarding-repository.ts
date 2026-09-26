import type { CompleteOnboardingRequest } from '@bubo/contracts';
import { database } from '../db';
import { normalizeManualBookKey } from '../lib/manual-book';

export async function persistCompletedOnboarding(
  databaseUrl: string,
  userId: string,
  input: CompleteOnboardingRequest,
) {
  const sql = database(databaseUrl);
  const isPrivate = input.socialPrivacy === 'private';

  const queries = [
    sql`
      update profiles
      set is_private = ${isPrivate},
          onboarding_completed_at = now()
      where user_id = ${userId}
    `,
    sql`
      insert into onboarding_preferences (
        user_id,
        reading_habit,
        first_book_skipped,
        notifications_step_completed
      )
      values (
        ${userId},
        ${input.readingHabit},
        ${input.firstBook === null},
        true
      )
      on conflict (user_id) do update
      set reading_habit = excluded.reading_habit,
          first_book_skipped = excluded.first_book_skipped,
          notifications_step_completed = excluded.notifications_step_completed
    `,
    sql`
      update notification_preferences
      set push_enabled = ${input.notifications.pushEnabled},
          reading_reminders = ${input.notifications.readingReminders},
          review_reminders = ${input.notifications.reviewReminders}
      where user_id = ${userId}
    `,
    sql`delete from user_onboarding_goals where user_id = ${userId}`,
    ...input.goals.map(
      (goal) => sql`
        insert into user_onboarding_goals (user_id, goal_key)
        values (${userId}, ${goal})
        on conflict (user_id, goal_key) do nothing
      `,
    ),
    sql`delete from user_interests where user_id = ${userId}`,
    ...input.interests.map(
      (interest) => sql`
        insert into user_interests (user_id, interest_key)
        values (${userId}, ${interest})
        on conflict (user_id, interest_key) do nothing
      `,
    ),
    sql`
      update reading_goals
      set active = false
      where user_id = ${userId}
        and goal_type = 'annual_books'
        and active = true
    `,
    sql`
      insert into reading_goals (
        user_id,
        goal_type,
        target_value,
        starts_on,
        ends_on,
        active
      )
      values (
        ${userId},
        'annual_books',
        ${input.annualBookGoal},
        date_trunc('year', now())::date,
        (date_trunc('year', now()) + interval '1 year - 1 day')::date,
        true
      )
    `,
  ];

  if (input.firstBook) {
    const sourceId = normalizeManualBookKey(
      input.firstBook.title,
      input.firstBook.author,
    );

    queries.push(sql`
      with selected_work as (
        insert into works (
          title,
          primary_author,
          source,
          source_id
        )
        values (
          ${input.firstBook.title},
          ${input.firstBook.author},
          'manual',
          ${sourceId}
        )
        on conflict (source, source_id) do update
        set title = excluded.title,
            primary_author = excluded.primary_author,
            updated_at = now()
        returning id
      )
      insert into user_books (
        user_id,
        work_id,
        status,
        current_page,
        progress_percent,
        started_at
      )
      select
        ${userId},
        id,
        'reading',
        0,
        0,
        now()
      from selected_work
      on conflict (user_id, work_id) do update
      set status = 'reading',
          started_at = coalesce(user_books.started_at, now()),
          updated_at = now()
    `);
  }

  await sql.transaction(queries);
}
