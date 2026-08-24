-- Vyrn Initial Schema
-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  goal text check (goal in ('strength', 'endurance', 'fat_loss', 'general')),
  fitness_level text check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Challenges
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  exercise_list jsonb not null default '[]',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Challenge entries (scores)
create table if not exists public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score_seconds integer not null, -- lower is better (time-based)
  notes text,
  video_url text,
  completed_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(challenge_id, user_id)
);

-- Workouts log
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  duration_seconds integer,
  exercises jsonb default '[]',
  completed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.workouts enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Challenges policies
create policy "Challenges are viewable by everyone"
  on public.challenges for select using (true);

-- Challenge entries policies
create policy "Entries viewable by everyone"
  on public.challenge_entries for select using (true);
create policy "Users can insert own entries"
  on public.challenge_entries for insert with check (auth.uid() = user_id);
create policy "Users can update own entries"
  on public.challenge_entries for update using (auth.uid() = user_id);

-- Workouts policies
create policy "Users can view own workouts"
  on public.workouts for select using (auth.uid() = user_id);
create policy "Users can insert own workouts"
  on public.workouts for insert with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seed one active challenge
insert into public.challenges (title, description, start_date, end_date, exercise_list, is_active)
values (
  'Forge Circuit #1',
  'Timed bodyweight circuit. Complete for time. Lower time ranks higher.',
  now() - interval '1 day',
  now() + interval '6 days',
  '[
    {"name": "Air Squats", "reps": 40},
    {"name": "Push-ups", "reps": 30},
    {"name": "Walking Lunges", "reps": 40},
    {"name": "Burpees", "reps": 20},
    {"name": "Mountain Climbers", "reps": 50},
    {"name": "Plank", "duration_seconds": 60}
  ]'::jsonb,
  true
) on conflict do nothing;
