-- RepTrack — initial schema
-- Every user-owned row carries user_id and is protected by row level security.
-- The exercise library (muscle_groups, exercises, exercise_equipment) is public read-only.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────── helpers

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────── profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Athlete',
  avatar_url text,
  age smallint check (age between 13 and 100),
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 25 and 350),
  experience text not null default 'intermediate' check (experience in ('beginner', 'intermediate', 'advanced')),
  preferred_days text[] not null default array['mon', 'wed', 'fri'],
  preferred_duration_minutes smallint not null default 60 check (preferred_duration_minutes between 10 and 240),
  training_preferences text[] not null default '{}',
  unit text not null default 'kg' check (unit in ('kg', 'lb')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Athlete'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────── goals

create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal text not null check (goal in ('build_muscle', 'lose_fat', 'increase_strength', 'improve_endurance', 'general_fitness')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, goal)
);
create index user_goals_user_idx on public.user_goals (user_id);
create unique index user_goals_one_primary_idx on public.user_goals (user_id) where is_primary;

-- ─────────────────────────────────────────────────────────── exercise library

create table public.muscle_groups (
  id text primary key,
  name text not null,
  sort_order smallint not null default 0
);

create table public.exercises (
  id text primary key, -- stable slug shared with the app's bundled catalog
  name text not null,
  muscle_group_id text not null references public.muscle_groups (id),
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  type text not null check (type in ('compound', 'isolation', 'bodyweight', 'isometric')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  description text not null default '',
  instructions text[] not null default '{}',
  tips text[] not null default '{}',
  recommended_sets smallint not null default 3,
  recommended_reps text not null default '8-12',
  rest_seconds smallint not null default 90,
  is_timed boolean not null default false,
  is_bodyweight boolean not null default false,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exercises_muscle_group_idx on public.exercises (muscle_group_id);
create index exercises_difficulty_idx on public.exercises (difficulty);
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

create table public.exercise_equipment (
  exercise_id text not null references public.exercises (id) on delete cascade,
  equipment text not null check (equipment in ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'bench', 'pull-up bar', 'ez bar', 'plate')),
  primary key (exercise_id, equipment)
);
create index exercise_equipment_equipment_idx on public.exercise_equipment (equipment);

-- ─────────────────────────────────────────────────────────── templates

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  focus text[] not null default '{}',
  estimated_minutes smallint not null default 45,
  -- [{ exerciseId, sets, reps, restSeconds }]
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_templates_user_idx on public.workout_templates (user_id, updated_at desc);
create trigger workout_templates_updated_at before update on public.workout_templates
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────── workouts

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Not a foreign key: templates can be deleted while history keeps the link for analytics.
  template_id uuid,
  name text not null,
  status text not null default 'completed' check (status in ('in_progress', 'completed', 'discarded')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  position smallint not null,
  notes text not null default '',
  rest_seconds smallint not null default 90,
  created_at timestamptz not null default now()
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id, position);
create index workout_exercises_user_exercise_idx on public.workout_exercises (user_id, exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null,
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'drop', 'failure')),
  weight_kg numeric(6, 2) check (weight_kg >= 0),
  reps smallint check (reps >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index workout_sets_exercise_idx on public.workout_sets (workout_exercise_id, position);
create index workout_sets_user_idx on public.workout_sets (user_id);

-- ─────────────────────────────────────────────────────────── records & favorites

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  record_type text not null check (record_type in ('max_weight', 'estimated_1rm', 'max_reps', 'max_volume')),
  value numeric(8, 2) not null,
  reps smallint,
  workout_id uuid references public.workouts (id) on delete set null,
  achieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id, record_type)
);
create index personal_records_user_idx on public.personal_records (user_id, achieved_at desc);

create table public.user_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- ─────────────────────────────────────────────────────────── AI coach

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- { workout?, exerciseIds?, quickActions? }
  payload jsonb,
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- ─────────────────────────────────────────────────────────── row level security

alter table public.profiles enable row level security;
alter table public.user_goals enable row level security;
alter table public.muscle_groups enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_equipment enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.personal_records enable row level security;
alter table public.user_favorites enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Library: anyone can read, nobody writes from the client (seed / service role only).
create policy "Library is readable" on public.muscle_groups for select using (true);
create policy "Exercises are readable" on public.exercises for select using (true);
create policy "Equipment is readable" on public.exercise_equipment for select using (true);

-- Profiles: a user sees and edits only their own.
create policy "Read own profile" on public.profiles for select using ((select auth.uid()) = id);
create policy "Insert own profile" on public.profiles for insert with check ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Owner-only access for every user_id table.
do $$
declare t text;
begin
  foreach t in array array[
    'user_goals', 'workout_templates', 'workouts', 'workout_exercises', 'workout_sets',
    'personal_records', 'user_favorites', 'ai_conversations', 'ai_messages'
  ] loop
    execute format('create policy "Owner can read" on public.%I for select using ((select auth.uid()) = user_id)', t);
    execute format('create policy "Owner can insert" on public.%I for insert with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Owner can update" on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Owner can delete" on public.%I for delete using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- Children must belong to a parent the same user owns.
create policy "Exercise rows reference own workout" on public.workout_exercises as restrictive for insert
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy "Set rows reference own exercise row" on public.workout_sets as restrictive for insert
  with check (exists (select 1 from public.workout_exercises we where we.id = workout_exercise_id and we.user_id = (select auth.uid())));
create policy "Messages reference own conversation" on public.ai_messages as restrictive for insert
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));

-- ─────────────────────────────────────────────────────────── storage

insert into storage.buckets (id, name, public) values ('exercise-images', 'exercise-images', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "Exercise images are public" on storage.objects for select using (bucket_id = 'exercise-images');
create policy "Avatars are public" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
