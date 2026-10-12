-- 0013_backup_restore.sql : restore_backup — T26, FR-DATA-02 (TC-DATA-02).
-- Restores a JSON backup (format 'my-vehicle-spend-backup', schemaVersion 1) into an EMPTY account.
-- IDs are kept from the file. user_id is always the signed-in user, never the file's value.
-- Runs in one transaction: any bad row rolls the whole restore back.

-- Adds user_id = auth.uid() to each row of one array in the backup file.
create or replace function public._backup_rows(p_payload jsonb, p_key text, p_uid uuid)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(e || jsonb_build_object('user_id', p_uid)), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_payload -> p_key, '[]'::jsonb)) e;
$$;

create or replace function public.restore_backup(p_payload jsonb)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_n      integer;
  v_counts jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_payload ->> 'format' is distinct from 'my-vehicle-spend-backup'
     or p_payload -> 'schemaVersion' is distinct from '1'::jsonb then
    raise exception 'This file is not a backup this version can restore.' using errcode = '22023';
  end if;

  -- Only an account with no rows at all may be restored into (FR-DATA-02).
  if exists (select 1 from public.vehicles where user_id = v_uid)
     or exists (select 1 from public.expense_categories where user_id = v_uid)
     or exists (select 1 from public.expenses where user_id = v_uid)
     or exists (select 1 from public.fuel_logs where user_id = v_uid)
     or exists (select 1 from public.loans where user_id = v_uid)
     or exists (select 1 from public.reminders where user_id = v_uid) then
    raise exception 'Restore needs an empty account. Your account already has data.' using errcode = '22023';
  end if;

  insert into public.expense_categories
    select r.* from jsonb_populate_recordset(null::public.expense_categories,
      public._backup_rows(p_payload, 'expenseCategories', v_uid)) r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('expenseCategories', v_n);

  insert into public.vehicles
    select r.* from jsonb_populate_recordset(null::public.vehicles,
      public._backup_rows(p_payload, 'vehicles', v_uid)) r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('vehicles', v_n);

  insert into public.expenses
    select r.* from jsonb_populate_recordset(null::public.expenses,
      public._backup_rows(p_payload, 'expenses', v_uid)) r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('expenses', v_n);

  insert into public.fuel_logs
    select r.* from jsonb_populate_recordset(null::public.fuel_logs,
      public._backup_rows(p_payload, 'fuelLogs', v_uid)) r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('fuelLogs', v_n);

  insert into public.loans
    select r.* from jsonb_populate_recordset(null::public.loans,
      public._backup_rows(p_payload, 'loans', v_uid)) r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('loans', v_n);

  insert into public.loan_payments
    select r.* from jsonb_populate_recordset(null::public.loan_payments,
      public._backup_rows(p_payload, 'loanPayments', v_uid)) r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('loanPayments', v_n);

  insert into public.loan_events
    select r.* from jsonb_populate_recordset(null::public.loan_events,
      public._backup_rows(p_payload, 'loanEvents', v_uid)) r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('loanEvents', v_n);

  insert into public.reminders
    select r.* from jsonb_populate_recordset(null::public.reminders,
      public._backup_rows(p_payload, 'reminders', v_uid)) r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('reminders', v_n);

  return v_counts;
exception
  -- A backup keeps its IDs, so the originals must be gone (or the file restored into a fresh project).
  when unique_violation then
    raise exception 'Some IDs in this backup already exist. Restore into a fresh project, or after the original data has been removed.'
      using errcode = '22023';
end $$;

grant execute on function public.restore_backup(jsonb) to authenticated;
