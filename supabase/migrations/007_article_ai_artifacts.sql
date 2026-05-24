-- Cache per-user article-level AI artifacts to reduce repeated OpenAI calls.

create table if not exists public.article_ai_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('chunked_html', 'idioms', 'article_guide')),
  input_hash text not null,
  model text not null default '',
  payload jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, article_id, artifact_type, input_hash)
);

create index if not exists idx_article_ai_artifacts_user_article
  on public.article_ai_artifacts(user_id, article_id);

alter table public.article_ai_artifacts enable row level security;

drop policy if exists "Users can read own article AI artifacts"
  on public.article_ai_artifacts;

create policy "Users can read own article AI artifacts"
  on public.article_ai_artifacts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own article AI artifacts"
  on public.article_ai_artifacts;

create policy "Users can insert own article AI artifacts"
  on public.article_ai_artifacts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own article AI artifacts"
  on public.article_ai_artifacts;

create policy "Users can update own article AI artifacts"
  on public.article_ai_artifacts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.article_ai_artifacts to authenticated;
