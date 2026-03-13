-- WordReader synced settings and atomic vocabulary save

alter table public.user_settings
  add column if not exists default_lookup_intent text default 'translate' not null,
  add column if not exists ui_language text default 'en' not null,
  add column if not exists tap_behavior text default 'word' not null;

alter table public.user_settings
  drop constraint if exists user_settings_default_lookup_intent_check;

alter table public.user_settings
  add constraint user_settings_default_lookup_intent_check
  check (default_lookup_intent in ('translate', 'explain'));

alter table public.user_settings
  drop constraint if exists user_settings_ui_language_check;

alter table public.user_settings
  add constraint user_settings_ui_language_check
  check (ui_language in ('en', 'th'));

alter table public.user_settings
  drop constraint if exists user_settings_tap_behavior_check;

alter table public.user_settings
  add constraint user_settings_tap_behavior_check
  check (tap_behavior in ('word', 'sentence', 'off'));

create unique index if not exists idx_vocabulary_contexts_unique_sentence
  on public.vocabulary_contexts (
    vocabulary_item_id,
    article_id,
    md5(coalesce(original_sentence, ''))
  );

create or replace function public.save_vocabulary_entry(
  p_word text,
  p_thai_meaning text,
  p_english_meaning text,
  p_part_of_speech text,
  p_difficulty text,
  p_pronunciation text,
  p_last_source_name text,
  p_article_id uuid,
  p_original_sentence text,
  p_contextual_meaning text,
  p_context_explanation text
)
returns table (
  id uuid,
  word text,
  thai_meaning text,
  english_meaning text,
  part_of_speech text,
  difficulty text,
  pronunciation text,
  last_source_name text,
  context_inserted boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.vocabulary_items%rowtype;
  v_context_rows integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(coalesce(p_word, '')), '') is null then
    raise exception 'Word is required';
  end if;

  if p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'Difficulty must be easy, medium, or hard';
  end if;

  insert into public.vocabulary_items (
    user_id,
    word,
    thai_meaning,
    english_meaning,
    part_of_speech,
    difficulty,
    pronunciation,
    last_source_name
  )
  values (
    v_user_id,
    trim(p_word),
    coalesce(p_thai_meaning, ''),
    coalesce(p_english_meaning, ''),
    coalesce(p_part_of_speech, ''),
    p_difficulty,
    coalesce(nullif(trim(p_pronunciation), ''), trim(p_word)),
    coalesce(p_last_source_name, '')
  )
  on conflict (user_id, lower(word))
  do update set
    thai_meaning = excluded.thai_meaning,
    english_meaning = excluded.english_meaning,
    part_of_speech = excluded.part_of_speech,
    difficulty = excluded.difficulty,
    pronunciation = coalesce(nullif(trim(excluded.pronunciation), ''), vocabulary_items.pronunciation),
    last_source_name = coalesce(nullif(excluded.last_source_name, ''), vocabulary_items.last_source_name),
    updated_at = now()
  returning * into v_item;

  insert into public.review_states (
    user_id,
    vocabulary_item_id
  )
  values (
    v_user_id,
    v_item.id
  )
  on conflict (user_id, vocabulary_item_id) do nothing;

  if p_article_id is not null and nullif(trim(coalesce(p_original_sentence, '')), '') is not null then
    insert into public.vocabulary_contexts (
      vocabulary_item_id,
      article_id,
      original_sentence,
      contextual_meaning,
      context_explanation
    )
    values (
      v_item.id,
      p_article_id,
      trim(p_original_sentence),
      coalesce(p_contextual_meaning, ''),
      coalesce(p_context_explanation, '')
    )
    on conflict do nothing;

    get diagnostics v_context_rows = row_count;
  end if;

  return query
  select
    v_item.id,
    v_item.word,
    v_item.thai_meaning,
    v_item.english_meaning,
    v_item.part_of_speech,
    v_item.difficulty,
    v_item.pronunciation,
    v_item.last_source_name,
    v_context_rows > 0;
end;
$$;

grant execute on function public.save_vocabulary_entry(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text
) to authenticated;
