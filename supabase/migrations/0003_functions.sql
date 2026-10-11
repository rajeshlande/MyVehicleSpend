-- 0003_functions.sql : RPC functions and triggers
-- Source: docs/02-architecture/04-database-schema.md §5 (add_fuel_log made idempotent)

-- Atomic fuel log + expense
create or replace function public.add_fuel_log(
  p_id uuid, p_vehicle_id uuid, p_filled_on date, p_odometer_km integer,
  p_litres numeric, p_price_per_litre numeric, p_is_full_tank boolean,
  p_station text, p_payment_mode text, p_category_id uuid
) returns public.fuel_logs
language plpgsql security invoker set search_path = public as $$
declare
  v_expense_id uuid := gen_random_uuid();
  v_total numeric(12,2) := round(p_litres * p_price_per_litre, 2);
  v_row public.fuel_logs;
begin
  -- Idempotency: a retry with the same client id returns the existing row and creates nothing.
  select * into v_row from public.fuel_logs where id = p_id;
  if found then
    return v_row;
  end if;

  insert into public.expenses (id, user_id, vehicle_id, category_id, expense_date, amount,
                               payment_mode, odometer_km, vendor, source)
  values (v_expense_id, auth.uid(), p_vehicle_id, p_category_id, p_filled_on, v_total,
          p_payment_mode, p_odometer_km, p_station, 'fuel');

  insert into public.fuel_logs (id, user_id, vehicle_id, expense_id, filled_on, odometer_km,
        litres, price_per_unit, total_amount, is_full_tank, station, payment_mode)
  values (p_id, auth.uid(), p_vehicle_id, v_expense_id, p_filled_on, p_odometer_km,
        p_litres, p_price_per_litre, v_total, p_is_full_tank, p_station, p_payment_mode)
  returning * into v_row;

  return v_row;
end $$;

-- Odometer rule (RLS-safe check in a trigger)
create or replace function public.check_odometer_monotonic()
returns trigger language plpgsql as $$
declare v_max integer;
begin
  if new.odometer_km is null then return new; end if;
  select max(odometer_km) into v_max from public.fuel_logs
   where vehicle_id = new.vehicle_id and deleted_at is null and id <> new.id;
  if v_max is not null and new.odometer_km < v_max then
    raise exception 'Odometer % is lower than the last recorded reading %', new.odometer_km, v_max
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_fuel_odometer before insert or update on public.fuel_logs
  for each row execute function public.check_odometer_monotonic();
