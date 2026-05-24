-- WordReader learning profile settings
-- Stores learner preferences for future personalization.

alter table public.user_settings
  add column if not exists english_level text default 'B1' not null,
  add column if not exists learning_goal text default 'general' not null,
  add column if not exists preferred_accent text default 'us' not null,
  add column if not exists daily_listening_goal_min int default 10 not null,
  add column if not exists translation_density text default 'balanced' not null;

update public.user_settings
set
  english_level = coalesce(english_level, 'B1'),
  learning_goal = coalesce(learning_goal, 'general'),
  preferred_accent = coalesce(preferred_accent, 'us'),
  daily_listening_goal_min = coalesce(daily_listening_goal_min, 10),
  translation_density = coalesce(translation_density, 'balanced');

alter table public.user_settings
  alter column english_level set default 'B1',
  alter column english_level set not null,
  alter column learning_goal set default 'general',
  alter column learning_goal set not null,
  alter column preferred_accent set default 'us',
  alter column preferred_accent set not null,
  alter column daily_listening_goal_min set default 10,
  alter column daily_listening_goal_min set not null,
  alter column translation_density set default 'balanced',
  alter column translation_density set not null;

alter table public.user_settings
  drop constraint if exists user_settings_english_level_check;

alter table public.user_settings
  add constraint user_settings_english_level_check
  check (english_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.user_settings
  drop constraint if exists user_settings_learning_goal_check;

alter table public.user_settings
  add constraint user_settings_learning_goal_check
  check (learning_goal in ('general', 'business', 'exam', 'travel', 'conversation'));

alter table public.user_settings
  drop constraint if exists user_settings_preferred_accent_check;

alter table public.user_settings
  add constraint user_settings_preferred_accent_check
  check (preferred_accent in ('us', 'uk', 'au', 'any'));

alter table public.user_settings
  drop constraint if exists user_settings_translation_density_check;

alter table public.user_settings
  add constraint user_settings_translation_density_check
  check (translation_density in ('minimal', 'balanced', 'full'));
