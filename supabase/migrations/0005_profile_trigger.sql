-- 0005_profile_trigger.sql : create a profile row when a user signs up (FR-AUTH-05).
-- Runs as the owner (security definer) so it works before the user has a session.
-- Source: docs/03-technical/01-api-documentation.md §1.2 and STC TC-AUTH-01.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
