-- Bubo 4
-- 0001_core.sql
-- Foundation schema only. Authentication-provider tables are intentionally separate.
-- user_id values are opaque auth IDs (TEXT) so the app is not coupled to one auth implementation.

create extension if not exists pgcrypto;

create table if not exists app_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id text primary key,
  username text unique,
  display_name text not null,
  bio text,
  avatar_object_key text,
  locale text not null default 'pt-BR',
  timezone text,
  is_private boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  primary_author text not null,
  description text,
  language_code text,
  canonical_cover_url text,
  source text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create table if not exists editions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references works(id) on delete cascade,
  isbn10 text,
  isbn13 text,
  publisher text,
  published_date date,
  page_count integer check (page_count is null or page_count > 0),
  language_code text,
  cover_url text,
  source text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id),
  unique (isbn13)
);

create index if not exists editions_work_id_idx on editions(work_id);
create index if not exists editions_isbn10_idx on editions(isbn10) where isbn10 is not null;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reading_status') then
    create type reading_status as enum ('want_to_read', 'reading', 'read', 'abandoned');
  end if;
end $$;

create table if not exists user_books (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  work_id uuid not null references works(id) on delete cascade,
  edition_id uuid references editions(id) on delete set null,
  status reading_status not null default 'want_to_read',
  current_page integer not null default 0 check (current_page >= 0),
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  is_favorite boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_id)
);

create index if not exists user_books_user_status_idx on user_books(user_id, status);
create index if not exists user_books_user_updated_idx on user_books(user_id, updated_at desc);

create table if not exists reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_book_id uuid not null references user_books(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  start_page integer check (start_page is null or start_page >= 0),
  end_page integer check (end_page is null or end_page >= 0),
  target_minutes integer check (target_minutes is null or target_minutes > 0),
  status text not null default 'active' check (status in ('active','paused','completed','discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_page is null or end_page is null or end_page >= start_page)
);

create index if not exists reading_sessions_user_started_idx on reading_sessions(user_id, started_at desc);
create index if not exists reading_sessions_user_book_idx on reading_sessions(user_book_id, started_at desc);

create table if not exists reflections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_book_id uuid not null references user_books(id) on delete cascade,
  reading_session_id uuid references reading_sessions(id) on delete set null,
  title text,
  body text not null,
  page_number integer check (page_number is null or page_number >= 0),
  visibility text not null default 'private' check (visibility in ('private','followers','public')),
  contains_spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reflections_user_created_idx on reflections(user_id, created_at desc);
create index if not exists reflections_user_book_idx on reflections(user_book_id, created_at desc);

create table if not exists media_objects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text,
  object_key text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  purpose text not null,
  status text not null default 'active' check (status in ('pending','active','deleted')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

insert into app_meta (key, value)
values ('schema_version', jsonb_build_object('version', 1, 'name', 'bubo4-core'))
on conflict (key) do update
set value = excluded.value, updated_at = now();
