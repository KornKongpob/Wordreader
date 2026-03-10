-- WordReader feature expansion
-- Adds progress tracking, synced settings, notes, organization, quizzes, and reminders.

alter table public.articles
  add column if not exists description text default '';

alter table public.reading_history
  add column if not exists updated_at timestamptz default now() not null,
  add column if not exists last_position int default 0 not null,
  add column if not exists last_selected_text text,
  add column if not exists is_finished boolean default false not null;

-- Keep the most complete/latest row per user/article before enforcing uniqueness.
with ranked_history as (
  select
    id,
    row_number() over (
      partition by user_id, article_id
      order by
        coalesce(is_finished, false) desc,
        coalesce(last_position, 0) desc,
        coalesce(updated_at, read_at) desc,
        read_at desc,
        id desc
    ) as row_num
  from public.reading_history
)
delete from public.reading_history
where id in (
  select id
  from ranked_history
  where row_num > 1
);

create unique index if not exists idx_reading_history_user_article
  on public.reading_history(user_id, article_id);

drop policy if exists "Users can update own reading history"
  on public.reading_history;

create policy "Users can update own reading history"
  on public.reading_history for update
  using (auth.uid() = user_id);

alter table public.vocabulary_items
  add column if not exists tags text[] default '{}'::text[] not null,
  add column if not exists folder_name text default 'General' not null,
  add column if not exists starred boolean default false not null,
  add column if not exists notes text default '' not null,
  add column if not exists pronunciation text default '' not null,
  add column if not exists last_source_name text default '' not null;

alter table public.user_settings
  add column if not exists review_goal int default 10 not null,
  add column if not exists enable_notifications boolean default false not null,
  add column if not exists reminder_hour int default 19 not null,
  add column if not exists onboarding_completed boolean default false not null,
  add column if not exists enable_offline boolean default true not null,
  add column if not exists reader_mode text default 'phrase' not null;

alter table public.user_settings
  drop constraint if exists user_settings_reader_mode_check;

alter table public.user_settings
  add constraint user_settings_reader_mode_check
  check (reader_mode in ('word', 'phrase'));

alter table public.review_events
  drop constraint if exists review_events_rating_check;

alter table public.review_events
  add constraint review_events_rating_check
  check (rating in ('again', 'easy', 'medium', 'hard'));

create table if not exists public.article_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  unique (user_id, article_id)
);

alter table public.article_notes enable row level security;

drop policy if exists "Users can read own article notes"
  on public.article_notes;

create policy "Users can read own article notes"
  on public.article_notes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own article notes"
  on public.article_notes;

create policy "Users can insert own article notes"
  on public.article_notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own article notes"
  on public.article_notes;

create policy "Users can update own article notes"
  on public.article_notes for update
  using (auth.uid() = user_id);

create table if not exists public.article_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  quiz jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, article_id)
);

alter table public.article_quizzes enable row level security;

drop policy if exists "Users can read own article quizzes"
  on public.article_quizzes;

create policy "Users can read own article quizzes"
  on public.article_quizzes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own article quizzes"
  on public.article_quizzes;

create policy "Users can insert own article quizzes"
  on public.article_quizzes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own article quizzes"
  on public.article_quizzes;

create policy "Users can update own article quizzes"
  on public.article_quizzes for update
  using (auth.uid() = user_id);
