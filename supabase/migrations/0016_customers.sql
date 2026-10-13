-- 0016_customers.sql : a simple customer contact list (slice 6, Customers).
-- A customer is a name with optional phone, email and notes. Customers are not linked to bills
-- or products yet: customer billing is out of scope. Owner-only, the same pattern as 0002.

create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  phone       text check (phone is null or char_length(phone) <= 20),
  email       text check (email is null or char_length(email) <= 120),
  notes       text check (notes is null or char_length(notes) <= 500),
  created_at  timestamptz not null default now()
);

create index customers_user_name_idx on public.customers (user_id, name);

alter table public.customers enable row level security;

create policy "customers own select" on public.customers for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "customers own insert" on public.customers for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "customers own update" on public.customers for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "customers own delete" on public.customers for delete
  to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.customers to authenticated;
