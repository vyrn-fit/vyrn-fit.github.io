-- Vyrn body metrics (run in Supabase SQL editor if you want cloud sync of metrics)
alter table profiles add column if not exists sex text;
alter table profiles add column if not exists age int;
alter table profiles add column if not exists height_cm numeric;
alter table profiles add column if not exists weight_kg numeric;
alter table profiles add column if not exists activity_level text;
alter table profiles add column if not exists goal text;
alter table profiles add column if not exists goal_detail jsonb;
alter table profiles add column if not exists training_styles text[];
alter table profiles add column if not exists onboarding_complete boolean default false;
alter table profiles add column if not exists units text default 'metric';

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null,
  weight_kg numeric not null,
  created_at timestamptz default now(),
  unique(user_id, log_date)
);
alter table weight_logs enable row level security;
create policy "own weights" on weight_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
