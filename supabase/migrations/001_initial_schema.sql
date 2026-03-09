-- WordReader Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ─── Profiles ───
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Articles (shared, any user can read/create) ───
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  url text unique not null,
  title text not null,
  source_name text not null default 'CNN',
  author text,
  published_at timestamptz,
  image_url text,
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.articles enable row level security;

create policy "Anyone can read articles"
  on public.articles for select
  using (true);

create policy "Authenticated users can insert articles"
  on public.articles for insert
  with check (auth.role() = 'authenticated');

-- ─── Reading History ───
create table public.reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  read_at timestamptz default now() not null,
  reading_time_sec int
);

alter table public.reading_history enable row level security;

create policy "Users can read own reading history"
  on public.reading_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own reading history"
  on public.reading_history for insert
  with check (auth.uid() = user_id);

-- ─── Vocabulary Items ───
create table public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  word text not null,
  thai_meaning text not null default '',
  english_meaning text not null default '',
  part_of_speech text not null default '',
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.vocabulary_items enable row level security;

create policy "Users can read own vocabulary"
  on public.vocabulary_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own vocabulary"
  on public.vocabulary_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own vocabulary"
  on public.vocabulary_items for update
  using (auth.uid() = user_id);

create policy "Users can delete own vocabulary"
  on public.vocabulary_items for delete
  using (auth.uid() = user_id);

-- Unique word per user (same word can exist for different users)
create unique index idx_vocabulary_user_word on public.vocabulary_items(user_id, lower(word));

-- ─── Vocabulary Contexts (one word can have multiple contexts from different articles) ───
create table public.vocabulary_contexts (
  id uuid primary key default gen_random_uuid(),
  vocabulary_item_id uuid not null references public.vocabulary_items(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  original_sentence text not null,
  contextual_meaning text not null default '',
  context_explanation text not null default '',
  created_at timestamptz default now() not null
);

alter table public.vocabulary_contexts enable row level security;

-- Users can read contexts for their own vocabulary items
create policy "Users can read own vocabulary contexts"
  on public.vocabulary_contexts for select
  using (
    exists (
      select 1 from public.vocabulary_items vi
      where vi.id = vocabulary_item_id and vi.user_id = auth.uid()
    )
  );

create policy "Users can insert own vocabulary contexts"
  on public.vocabulary_contexts for insert
  with check (
    exists (
      select 1 from public.vocabulary_items vi
      where vi.id = vocabulary_item_id and vi.user_id = auth.uid()
    )
  );

-- ─── Review States (spaced repetition state per word per user) ───
create table public.review_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vocabulary_item_id uuid not null references public.vocabulary_items(id) on delete cascade,
  ease_factor float not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  next_review_at timestamptz default now() not null,
  last_reviewed_at timestamptz,
  unique (user_id, vocabulary_item_id)
);

alter table public.review_states enable row level security;

create policy "Users can read own review states"
  on public.review_states for select
  using (auth.uid() = user_id);

create policy "Users can insert own review states"
  on public.review_states for insert
  with check (auth.uid() = user_id);

create policy "Users can update own review states"
  on public.review_states for update
  using (auth.uid() = user_id);

-- ─── Review Events (log of each review) ───
create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vocabulary_item_id uuid not null references public.vocabulary_items(id) on delete cascade,
  rating text not null check (rating in ('easy', 'medium', 'hard')),
  reviewed_at timestamptz default now() not null
);

alter table public.review_events enable row level security;

create policy "Users can read own review events"
  on public.review_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own review events"
  on public.review_events for insert
  with check (auth.uid() = user_id);

-- ─── User Settings ───
create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  font_size int not null default 18,
  line_spacing float not null default 1.6,
  updated_at timestamptz default now() not null
);

alter table public.user_settings enable row level security;

create policy "Users can read own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);
