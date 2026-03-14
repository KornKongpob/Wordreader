-- Fix ambiguous column references in save_vocabulary_entry()

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
  v_existing_id uuid;
  v_context_rows integer := 0;
  v_normalized_word text := trim(coalesce(p_word, ''));
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(v_normalized_word, '') is null then
    raise exception 'Word is required';
  end if;

  if p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'Difficulty must be easy, medium, or hard';
  end if;

  select vi.id
  into v_existing_id
  from public.vocabulary_items as vi
  where vi.user_id = v_user_id
    and lower(vi.word) = lower(v_normalized_word)
  limit 1;

  if v_existing_id is not null then
    update public.vocabulary_items as vi
    set
      thai_meaning = coalesce(p_thai_meaning, ''),
      english_meaning = coalesce(p_english_meaning, ''),
      part_of_speech = coalesce(p_part_of_speech, ''),
      difficulty = p_difficulty,
      pronunciation = coalesce(nullif(trim(p_pronunciation), ''), v_normalized_word),
      last_source_name = coalesce(p_last_source_name, ''),
      updated_at = now()
    where vi.id = v_existing_id
    returning vi.* into v_item;
  else
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
      v_normalized_word,
      coalesce(p_thai_meaning, ''),
      coalesce(p_english_meaning, ''),
      coalesce(p_part_of_speech, ''),
      p_difficulty,
      coalesce(nullif(trim(p_pronunciation), ''), v_normalized_word),
      coalesce(p_last_source_name, '')
    )
    returning * into v_item;
  end if;

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
