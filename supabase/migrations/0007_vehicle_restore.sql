-- 0007_vehicle_restore.sql : restore a soft-deleted vehicle (T9b, schema doc N-7).
-- Restores only the linked rows that were removed by the same delete_vehicle call
-- (same deleted_at timestamp). Rows the user deleted earlier stay deleted.
-- The unique index on (user_id, registration_no) covers deleted rows too, so a deleted
-- number cannot be re-used for a new vehicle. The app offers Restore in that case.

create or replace function public.restore_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted_at timestamptz;
begin
  select deleted_at into v_deleted_at
  from public.vehicles
  where id = p_vehicle_id and user_id = auth.uid() and deleted_at is not null;

  if not found then
    raise exception 'vehicle not found' using errcode = 'P0002';
  end if;

  update public.vehicles set deleted_at = null, updated_at = now() where id = p_vehicle_id;
  update public.expenses   set deleted_at = null where vehicle_id = p_vehicle_id and deleted_at = v_deleted_at;
  update public.fuel_logs  set deleted_at = null where vehicle_id = p_vehicle_id and deleted_at = v_deleted_at;
  update public.reminders  set deleted_at = null where vehicle_id = p_vehicle_id and deleted_at = v_deleted_at;
  update public.loans      set deleted_at = null where vehicle_id = p_vehicle_id and deleted_at = v_deleted_at;
end $$;

grant execute on function public.restore_vehicle(uuid) to authenticated;
