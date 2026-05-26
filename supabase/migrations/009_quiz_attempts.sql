-- Persist article quiz attempts so comprehension practice can be tracked over time.

create table if not exists public.article_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  article_quiz_id uuid references public.article_quizzes(id) on delete set null,
  score int not null,
  total int not null,
  answers jsonb not null,
  completed_at timestamptz default now() not null,
  constraint article_quiz_attempts_total_check check (total > 0),
  constraint article_quiz_attempts_score_check check (score >= 0 and score <= total)
);

create index if not exists idx_article_quiz_attempts_user_article_completed
  on public.article_quiz_attempts(user_id, article_id, completed_at desc);

alter table public.article_quiz_attempts enable row level security;

drop policy if exists "Users can read own article quiz attempts"
  on public.article_quiz_attempts;

create policy "Users can read own article quiz attempts"
  on public.article_quiz_attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own article quiz attempts"
  on public.article_quiz_attempts;

create policy "Users can insert own article quiz attempts"
  on public.article_quiz_attempts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.article_quiz_attempts to authenticated;
