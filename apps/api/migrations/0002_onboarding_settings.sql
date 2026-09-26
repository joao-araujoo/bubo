-- Bubo 4
-- 0002_onboarding_settings.sql
-- Auth-independent onboarding, preferences, reading goals and notification/device settings.

create table if not exists user_settings (
  user_id text primary key
    references profiles(user_id)
    on delete cascade,

  theme text not null default 'system'
    check (theme in ('system', 'light', 'dark')),

  text_scale numeric(3,2) not null default 1.00
    check (text_scale >= 0.85 and text_scale <= 1.50),

  reduce_motion boolean not null default false,
  haptics_enabled boolean not null default true,
  sounds_enabled boolean not null default true,

  progress_mode text not null default 'pages'
    check (progress_mode in ('pages', 'percent')),

  default_session_minutes integer not null default 20
    check (default_session_minutes between 5 and 240),

  review_intensity text not null default 'balanced'
    check (review_intensity in ('light', 'balanced', 'deep')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists onboarding_preferences (
  user_id text primary key
    references profiles(user_id)
    on delete cascade,

  reading_habit text
    check (
      reading_habit is null
      or reading_habit in (
        'daily',
        'few_times_week',
        'when_possible',
        'returning_reader'
      )
    ),

  first_book_skipped boolean not null default false,
  notifications_step_completed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_interests (
  user_id text not null
    references profiles(user_id)
    on delete cascade,

  interest_key text not null,

  created_at timestamptz not null default now(),

  primary key (user_id, interest_key)
);

create table if not exists user_onboarding_goals (
  user_id text not null
    references profiles(user_id)
    on delete cascade,

  goal_key text not null
    check (
      goal_key in (
        'remember_more',
        'understand_better',
        'build_habit',
        'read_more',
        'study_technical_books',
        'reflect_on_stories'
      )
    ),

  created_at timestamptz not null default now(),

  primary key (user_id, goal_key)
);

create table if not exists reading_goals (
  id uuid primary key default gen_random_uuid(),

  user_id text not null
    references profiles(user_id)
    on delete cascade,

  goal_type text not null
    check (
      goal_type in (
        'annual_books',
        'weekly_sessions',
        'daily_minutes'
      )
    ),

  target_value integer not null
    check (target_value > 0),

  starts_on date not null,
  ends_on date not null,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ends_on >= starts_on)
);

create index if not exists reading_goals_user_active_idx
  on reading_goals(user_id, active, starts_on desc);

create table if not exists notification_preferences (
  user_id text primary key
    references profiles(user_id)
    on delete cascade,

  push_enabled boolean not null default true,
  email_enabled boolean not null default false,

  reading_reminders boolean not null default true,
  review_reminders boolean not null default true,
  streak_reminders boolean not null default true,
  community_notifications boolean not null default true,
  club_notifications boolean not null default true,
  achievement_notifications boolean not null default true,

  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    quiet_hours_enabled = false
    or (
      quiet_hours_start is not null
      and quiet_hours_end is not null
    )
  )
);

create table if not exists push_devices (
  id uuid primary key default gen_random_uuid(),

  user_id text not null
    references profiles(user_id)
    on delete cascade,

  platform text not null
    check (platform in ('ios', 'android')),

  expo_push_token text not null unique,
  device_id text,
  device_name text,

  enabled boolean not null default true,

  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_devices_user_enabled_idx
  on push_devices(user_id, enabled);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_updated_at();

drop trigger if exists works_set_updated_at on works;
create trigger works_set_updated_at
before update on works
for each row execute function set_updated_at();

drop trigger if exists editions_set_updated_at on editions;
create trigger editions_set_updated_at
before update on editions
for each row execute function set_updated_at();

drop trigger if exists user_books_set_updated_at on user_books;
create trigger user_books_set_updated_at
before update on user_books
for each row execute function set_updated_at();

drop trigger if exists reading_sessions_set_updated_at on reading_sessions;
create trigger reading_sessions_set_updated_at
before update on reading_sessions
for each row execute function set_updated_at();

drop trigger if exists reflections_set_updated_at on reflections;
create trigger reflections_set_updated_at
before update on reflections
for each row execute function set_updated_at();

drop trigger if exists user_settings_set_updated_at on user_settings;
create trigger user_settings_set_updated_at
before update on user_settings
for each row execute function set_updated_at();

drop trigger if exists onboarding_preferences_set_updated_at on onboarding_preferences;
create trigger onboarding_preferences_set_updated_at
before update on onboarding_preferences
for each row execute function set_updated_at();

drop trigger if exists reading_goals_set_updated_at on reading_goals;
create trigger reading_goals_set_updated_at
before update on reading_goals
for each row execute function set_updated_at();

drop trigger if exists notification_preferences_set_updated_at on notification_preferences;
create trigger notification_preferences_set_updated_at
before update on notification_preferences
for each row execute function set_updated_at();

drop trigger if exists push_devices_set_updated_at on push_devices;
create trigger push_devices_set_updated_at
before update on push_devices
for each row execute function set_updated_at();

insert into app_meta (key, value)
values ('schema_version', jsonb_build_object('version', 2, 'name', 'bubo4-onboarding-settings'))
on conflict (key) do update
set value = excluded.value, updated_at = now();
