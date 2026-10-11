-- 0006_vehicle_delete.sql : soft-delete a vehicle with all linked rows in one transaction.
-- FR-VEH-03, RULE-06, SDD §7 (soft delete on synced tables), STC TC-VEH-06.
-- Rows are hidden (deleted_at set), not removed, so the offline sync engine can replicate deletes.
-- Hard removal happens only in the account-deletion job (see schema doc §8).

create or replace function public.delete_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  -- Ownership check. RLS would silently match zero rows for someone else's vehicle,
  -- so raise an explicit error the app can map to a message.
  if not exists (
    select 1 from public.vehicles
    where id = p_vehicle_id and user_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'vehicle not found' using errcode = 'P0002';
  end if;

  update public.expenses   set deleted_at = v_now where vehicle_id = p_vehicle_id and deleted_at is null;
  update public.fuel_logs  set deleted_at = v_now where vehicle_id = p_vehicle_id and deleted_at is null;
  update public.reminders  set deleted_at = v_now where vehicle_id = p_vehicle_id and deleted_at is null;
  update public.loans      set deleted_at = v_now where vehicle_id = p_vehicle_id and deleted_at is null;
  update public.vehicles   set deleted_at = v_now where id = p_vehicle_id;
end $$;

grant execute on function public.delete_vehicle(uuid) to authenticated;
