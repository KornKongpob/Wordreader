-- WordReader profile self-heal
-- Backfills missing profiles and lets authenticated users recreate their own profile row.

insert into public.profiles (id, email, display_name)
select
  users.id,
  coalesce(users.email, users.id::text || '@wordreader.local'),
  coalesce(
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(users.email, users.id::text || '@wordreader.local'), '@', 1)
  )
from auth.users as users
on conflict (id) do nothing;

drop policy if exists "Users can insert own profile"
  on public.profiles;

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
