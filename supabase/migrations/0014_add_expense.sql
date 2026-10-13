-- 0014_add_expense.sql : idempotent expense create by client id — T29c, FR-PWA-04/05, TC-PWA-05.
-- An offline save is queued with a client UUID. A replay after a dropped response reuses that UUID,
-- so the insert uses ON CONFLICT DO NOTHING and the retry returns the existing row, creating nothing.

create or replace function public.add_expense(
  p_id uuid,
  p_vehicle_id uuid,
  p_category_id uuid,
  p_expense_date date,
  p_amount numeric,
  p_gst_amount numeric default 0,
  p_payment_mode text default null,
  p_vendor text default null,
  p_odometer_km integer default null,
  p_notes text default null
) returns public.expenses
language plpgsql security invoker set search_path = public as $$
declare
  v_row public.expenses;
begin
  insert into public.expenses (id, user_id, vehicle_id, category_id, expense_date, amount, gst_amount,
                               payment_mode, vendor, odometer_km, notes, source)
  values (p_id, auth.uid(), p_vehicle_id, p_category_id, p_expense_date, p_amount, coalesce(p_gst_amount, 0),
          p_payment_mode, p_vendor, p_odometer_km, p_notes, 'manual')
  on conflict (id) do nothing
  returning * into v_row;

  if not found then
    -- The id already exists. Row-level security hides other users' rows, so a foreign id is refused here.
    select * into v_row from public.expenses where id = p_id;
    if not found then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
  end if;

  return v_row;
end $$;

grant execute on function public.add_expense(uuid, uuid, uuid, date, numeric, numeric, text, text, integer, text)
  to authenticated;
