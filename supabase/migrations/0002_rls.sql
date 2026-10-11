-- 0002_rls.sql : Row Level Security policies
-- Source: docs/02-architecture/04-database-schema.md §4 (expanded repeated policies)

-- Enable RLS on every exposed table
alter table public.profiles            enable row level security;
alter table public.vehicles            enable row level security;
alter table public.expense_categories  enable row level security;
alter table public.fuel_logs           enable row level security;
alter table public.expenses            enable row level security;
alter table public.loans               enable row level security;
alter table public.loan_payments       enable row level security;
alter table public.loan_events         enable row level security;
alter table public.reminders           enable row level security;

-- Owner-only policy template (applied to each user-owned table)
-- Pattern: (select auth.uid()) is cached per statement => faster.
create policy "own rows select" on public.vehicles for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.vehicles for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.vehicles for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows delete" on public.vehicles for delete
  to authenticated using ((select auth.uid()) = user_id);
-- Owner-only policies for the remaining user-owned tables
create policy "fuel_logs own select" on public.fuel_logs for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "fuel_logs own insert" on public.fuel_logs for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "fuel_logs own update" on public.fuel_logs for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "fuel_logs own delete" on public.fuel_logs for delete
  to authenticated using ((select auth.uid()) = user_id);
create policy "expenses own select" on public.expenses for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "expenses own insert" on public.expenses for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "expenses own update" on public.expenses for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expenses own delete" on public.expenses for delete
  to authenticated using ((select auth.uid()) = user_id);
create policy "loans own select" on public.loans for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "loans own insert" on public.loans for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "loans own update" on public.loans for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "loans own delete" on public.loans for delete
  to authenticated using ((select auth.uid()) = user_id);
create policy "loan_payments own select" on public.loan_payments for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "loan_payments own insert" on public.loan_payments for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "loan_payments own update" on public.loan_payments for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "loan_payments own delete" on public.loan_payments for delete
  to authenticated using ((select auth.uid()) = user_id);
create policy "loan_events own select" on public.loan_events for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "loan_events own insert" on public.loan_events for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "loan_events own update" on public.loan_events for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "loan_events own delete" on public.loan_events for delete
  to authenticated using ((select auth.uid()) = user_id);
create policy "reminders own select" on public.reminders for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "reminders own insert" on public.reminders for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "reminders own update" on public.reminders for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reminders own delete" on public.reminders for delete
  to authenticated using ((select auth.uid()) = user_id);

-- Profiles: id is the user id
create policy "profile self" on public.profiles for all
  to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Expense categories: everyone reads system rows; users manage their own
create policy "categories read" on public.expense_categories for select
  to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "categories write own" on public.expense_categories for all
  to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Anonymous users: no access (no policies granted to anon)
revoke all on all tables in schema public from anon;
-- Authenticated role needs table privileges; RLS then limits rows. (Supabase grants this by default; explicit here for reproducibility.)
grant select, insert, update, delete on all tables in schema public to authenticated;
