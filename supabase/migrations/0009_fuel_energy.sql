-- 0009_fuel_energy.sql : add_fuel_log accepts litres (liquid fuel, CNG, LPG) or kWh (EV) — T16a, FR-FUEL-05.
-- Keeps the atomic insert of fuel row + linked expense, and the idempotent early return (N-3).
-- The 10-argument version from 0003 is dropped so there is one function with one signature.

drop function if exists public.add_fuel_log(uuid, uuid, date, integer, numeric, numeric, boolean, text, text, uuid);

create or replace function public.add_fuel_log(
  p_id uuid, p_vehicle_id uuid, p_filled_on date, p_odometer_km integer,
  p_litres numeric, p_price_per_litre numeric, p_is_full_tank boolean,
  p_station text, p_payment_mode text, p_category_id uuid,
  p_energy_kwh numeric default null
) returns public.fuel_logs
language plpgsql security invoker set search_path = public as $$
declare
  v_expense_id uuid := gen_random_uuid();
  v_total numeric(12,2);
  v_row public.fuel_logs;
begin
  -- Idempotency: a retry with the same client id returns the existing row and creates nothing.
  select * into v_row from public.fuel_logs where id = p_id;
  if found then
    return v_row;
  end if;

  -- A fill is either liquid (litres) or energy (kWh), never both and never neither.
  if (p_litres is null) = (p_energy_kwh is null) then
    raise exception 'Enter exactly one of litres or kWh.' using errcode = '22023';
  end if;

  v_total := round(coalesce(p_litres, p_energy_kwh) * p_price_per_litre, 2);

  insert into public.expenses (id, user_id, vehicle_id, category_id, expense_date, amount,
                               payment_mode, odometer_km, vendor, source)
  values (v_expense_id, auth.uid(), p_vehicle_id, p_category_id, p_filled_on, v_total,
          p_payment_mode, p_odometer_km, p_station, 'fuel');

  insert into public.fuel_logs (id, user_id, vehicle_id, expense_id, filled_on, odometer_km,
        litres, energy_kwh, price_per_unit, total_amount, is_full_tank, station, payment_mode)
  values (p_id, auth.uid(), p_vehicle_id, v_expense_id, p_filled_on, p_odometer_km,
        p_litres, p_energy_kwh, p_price_per_litre, v_total, p_is_full_tank, p_station, p_payment_mode)
  returning * into v_row;

  return v_row;
end $$;

grant execute on function public.add_fuel_log(uuid, uuid, date, integer, numeric, numeric, boolean, text, text, uuid, numeric) to authenticated;
