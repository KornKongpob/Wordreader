-- Richer vocabulary learning metadata

alter table public.vocabulary_items
  add column if not exists lemma text default '' not null,
  add column if not exists cefr_level text default '' not null,
  add column if not exists synonyms text[] default '{}'::text[] not null,
  add column if not exists antonyms text[] default '{}'::text[] not null,
  add column if not exists word_family jsonb default '[]'::jsonb not null,
  add column if not exists collocations jsonb default '[]'::jsonb not null;

update public.vocabulary_items
set
  lemma = coalesce(lemma, ''),
  cefr_level = coalesce(cefr_level, ''),
  synonyms = coalesce(synonyms, '{}'::text[]),
  antonyms = coalesce(antonyms, '{}'::text[]),
  word_family = coalesce(word_family, '[]'::jsonb),
  collocations = coalesce(collocations, '[]'::jsonb);

alter table public.vocabulary_items
  alter column lemma set default '',
  alter column lemma set not null,
  alter column cefr_level set default '',
  alter column cefr_level set not null,
  alter column synonyms set default '{}'::text[],
  alter column synonyms set not null,
  alter column antonyms set default '{}'::text[],
  alter column antonyms set not null,
  alter column word_family set default '[]'::jsonb,
  alter column word_family set not null,
  alter column collocations set default '[]'::jsonb,
  alter column collocations set not null;

alter table public.vocabulary_items
  drop constraint if exists vocabulary_items_cefr_level_check;

alter table public.vocabulary_items
  add constraint vocabulary_items_cefr_level_check
  check (cefr_level = '' or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

drop function if exists public.save_vocabulary_entry(
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
  p_context_explanation text,
  p_lemma text default '',
  p_cefr_level text default '',
  p_synonyms text[] default '{}'::text[],
  p_antonyms text[] default '{}'::text[],
  p_word_family jsonb default '[]'::jsonb,
  p_collocations jsonb default '[]'::jsonb
)
returns table (
  id uuid,
  word text,
  thai_meaning text,
  english_meaning text,
  part_of_speech text,
  difficulty text,
  lemma text,
  cefr_level text,
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
  v_cefr_level text := upper(trim(coalesce(p_cefr_level, '')));
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

  if v_cefr_level <> '' and v_cefr_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then
    raise exception 'CEFR level must be empty or A1-C2';
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
      lemma = coalesce(nullif(trim(p_lemma), ''), vi.lemma),
      cefr_level = coalesce(nullif(v_cefr_level, ''), vi.cefr_level),
      synonyms = case
        when cardinality(coalesce(p_synonyms, '{}'::text[])) > 0 then p_synonyms
        else vi.synonyms
      end,
      antonyms = case
        when cardinality(coalesce(p_antonyms, '{}'::text[])) > 0 then p_antonyms
        else vi.antonyms
      end,
      word_family = case
        when jsonb_typeof(coalesce(p_word_family, '[]'::jsonb)) = 'array'
          and jsonb_array_length(coalesce(p_word_family, '[]'::jsonb)) > 0
          then p_word_family
        else vi.word_family
      end,
      collocations = case
        when jsonb_typeof(coalesce(p_collocations, '[]'::jsonb)) = 'array'
          and jsonb_array_length(coalesce(p_collocations, '[]'::jsonb)) > 0
          then p_collocations
        else vi.collocations
      end,
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
      lemma,
      cefr_level,
      synonyms,
      antonyms,
      word_family,
      collocations,
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
      coalesce(trim(p_lemma), ''),
      v_cefr_level,
      coalesce(p_synonyms, '{}'::text[]),
      coalesce(p_antonyms, '{}'::text[]),
      coalesce(p_word_family, '[]'::jsonb),
      coalesce(p_collocations, '[]'::jsonb),
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
    v_item.lemma,
    v_item.cefr_level,
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
  text,
  text,
  text,
  text[],
  text[],
  jsonb,
  jsonb
) to authenticated;
