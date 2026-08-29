-- Friends challenges, members, activity (applied 2026-08-29)
alter table public.profiles add column if not exists display_name text;
alter table public.challenges add column if not exists creator_id uuid references auth.users(id) on delete set null;
alter table public.challenges add column if not exists invite_code text;
alter table public.challenges add column if not exists kind text default 'public';
alter table public.challenges add column if not exists workout_id text;
alter table public.challenges add column if not exists goal text default 'best_time';
create unique index if not exists challenges_invite_code_uidx on public.challenges (invite_code) where invite_code is not null;
create table if not exists public.challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  unique (challenge_id, user_id)
);
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.workouts add column if not exists workout_id text;
alter table public.workouts add column if not exists total_reps integer;
