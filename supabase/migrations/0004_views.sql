-- 0004_views.sql : reporting views
-- Source: docs/02-architecture/04-database-schema.md §6 (v_fuel_efficiency WINDOW clause fixed)

-- Monthly spend per vehicle and category (Indian FY can be derived in app)
create or replace view public.v_monthly_spend
with (security_invoker = true) as
select e.user_id, e.vehicle_id,
       date_trunc('month', e.expense_date)::date as month,
       c.group_name, c.name as category,
       sum(e.amount)     as total_amount,
       sum(e.gst_amount) as total_gst,
       count(*)          as entries
from public.expenses e
join public.expense_categories c on c.id = e.category_id
where e.deleted_at is null
group by 1,2,3,4,5;

-- Fuel efficiency between consecutive full tanks
create or replace view public.v_fuel_efficiency
with (security_invoker = true) as
with fulls as (
  select user_id, vehicle_id, filled_on, odometer_km, litres,
         lag(odometer_km) over (partition by vehicle_id order by odometer_km) as prev_odo
  from public.fuel_logs
  where is_full_tank and litres is not null and deleted_at is null
)
select user_id, vehicle_id, filled_on, odometer_km,
       odometer_km - prev_odo as distance_km,
       round((odometer_km - prev_odo) / nullif(litres,0), 2) as kmpl
from fulls
where prev_odo is not null and odometer_km > prev_odo;

-- Views are created after the table-level grant in 0002, so grant them explicitly.
grant select on public.v_monthly_spend, public.v_fuel_efficiency to authenticated;
