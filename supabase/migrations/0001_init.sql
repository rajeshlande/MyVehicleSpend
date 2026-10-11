-- 0001_init.sql : My Vehicle Spend core schema (tables, constraints, triggers, indexes)
-- Source: docs/02-architecture/04-database-schema.md §3


-- ---------- generic helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- profiles ----------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text check (char_length(display_name) <= 60),
  currency      text not null default 'INR' check (currency = 'INR'),
  locale        text not null default 'en-IN',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- vehicles ----------
create table public.vehicles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_type      text not null check (vehicle_type in ('car','bike','scooter','other')),
  registration_no   text not null check (registration_no ~ '^[A-Z0-9]{4,12}$'),
  make              text check (char_length(make) <= 40),
  model             text check (char_length(model) <= 60),
  variant           text check (char_length(variant) <= 60),
  fuel_type         text not null check (fuel_type in ('petrol','diesel','cng','lpg','ev','hybrid')),
  purchase_date     date,
  purchase_price    numeric(12,2) check (purchase_price >= 0),
  start_odometer_km integer not null default 0 check (start_odometer_km >= 0),
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint vehicles_user_reg_unique unique (user_id, registration_no),
  constraint vehicles_user_id_key unique (id, user_id)   -- target for composite FKs
);

-- ---------- expense categories (system + user-defined) ----------
create table public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade, -- null = system category
  group_name  text not null,       -- e.g. 'Fuel & Energy'
  name        text not null,       -- e.g. 'Petrol'
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint expense_categories_unique unique nulls not distinct (user_id, group_name, name)
);

-- ---------- fuel logs (created together with an expense via RPC) ----------
create table public.fuel_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id      uuid not null,
  expense_id      uuid,
  filled_on       date not null,
  odometer_km     integer not null check (odometer_km >= 0),
  litres          numeric(8,3) check (litres > 0),           -- null for EV
  energy_kwh      numeric(8,3) check (energy_kwh > 0),       -- EV only
  price_per_unit  numeric(8,2) check (price_per_unit > 0),
  total_amount    numeric(12,2) not null check (total_amount > 0),
  is_full_tank    boolean not null default true,
  station         text check (char_length(station) <= 80),
  payment_mode    text check (payment_mode in ('cash','upi','card','netbanking','fastag','emi','other')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint fuel_logs_vehicle_fk foreign key (vehicle_id, user_id)
    references public.vehicles(id, user_id) on delete cascade,
  constraint fuel_logs_fuel_or_energy check (litres is not null or energy_kwh is not null)
);

-- ---------- expenses ----------
create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id    uuid not null,
  category_id   uuid not null references public.expense_categories(id),
  expense_date  date not null,
  amount        numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  gst_amount    numeric(12,2) not null default 0 check (gst_amount >= 0 and gst_amount <= amount),
  payment_mode  text check (payment_mode in ('cash','upi','card','netbanking','fastag','emi','other')),
  vendor        text check (char_length(vendor) <= 120),
  odometer_km   integer check (odometer_km >= 0),
  notes         text check (char_length(notes) <= 1000),
  receipt_paths text[] not null default '{}' check (cardinality(receipt_paths) <= 3),
  source        text not null default 'manual' check (source in ('manual','fuel','loan','reminder','import')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint expenses_vehicle_fk foreign key (vehicle_id, user_id)
    references public.vehicles(id, user_id) on delete cascade
);

-- link fuel_logs -> expenses (deferred to allow insert order inside RPC)
alter table public.fuel_logs
  add constraint fuel_logs_expense_fk foreign key (expense_id) references public.expenses(id) on delete set null;

-- ---------- loans ----------
create table public.loans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        uuid not null,
  lender            text not null check (char_length(lender) between 1 and 80),
  account_last4     text check (account_last4 ~ '^[0-9]{4}$'),
  principal         numeric(12,2) not null check (principal > 0),
  annual_rate       numeric(6,3) not null check (annual_rate >= 0 and annual_rate <= 60),
  tenure_months     integer not null check (tenure_months between 1 and 360),
  start_date        date not null,
  emi_amount        numeric(12,2) not null check (emi_amount > 0),
  interest_method   text not null default 'reducing' check (interest_method in ('reducing','flat')),
  processing_fee    numeric(12,2) not null default 0 check (processing_fee >= 0),
  other_charges     numeric(12,2) not null default 0 check (other_charges >= 0),
  status            text not null default 'active' check (status in ('active','closed')),
  closed_on         date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint loans_vehicle_fk foreign key (vehicle_id, user_id)
    references public.vehicles(id, user_id) on delete cascade
);

-- ---------- loan payments (schedule rows; created at loan creation) ----------
create table public.loan_payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  loan_id            uuid not null references public.loans(id) on delete cascade,
  installment_no     integer not null check (installment_no > 0),
  due_date           date not null,
  scheduled_emi      numeric(12,2) not null check (scheduled_emi > 0),
  principal_component numeric(12,2) not null check (principal_component >= 0),
  interest_component numeric(12,2) not null check (interest_component >= 0),
  opening_balance    numeric(12,2) not null check (opening_balance >= 0),
  closing_balance    numeric(12,2) not null check (closing_balance >= 0),
  paid_on            date,
  paid_amount        numeric(12,2) check (paid_amount >= 0),
  late_fee           numeric(12,2) not null default 0 check (late_fee >= 0),
  bounce_charge      numeric(12,2) not null default 0 check (bounce_charge >= 0),
  status             text not null default 'scheduled'
                     check (status in ('scheduled','paid','late','waived')),
  expense_id         uuid references public.expenses(id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint loan_payments_unique unique (loan_id, installment_no)
);

-- ---------- prepayment & foreclosure events ----------
create table public.loan_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  loan_id            uuid not null references public.loans(id) on delete cascade,
  event_type         text not null check (event_type in ('prepayment','foreclosure')),
  event_date         date not null,
  amount             numeric(12,2) not null check (amount > 0),
  charge_percent     numeric(5,2) not null default 0 check (charge_percent between 0 and 10),
  charge_amount      numeric(12,2) not null default 0 check (charge_amount >= 0),
  effect             text check (effect in ('reduce_tenure','reduce_emi')),
  notes              text,
  created_at         timestamptz not null default now()
);

-- ---------- reminders ----------
create table public.reminders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id         uuid not null,
  reminder_type      text not null check (reminder_type in
                       ('insurance','puc','fitness','licence','road_tax','service_date','service_km','loan_emi','custom')),
  title              text not null check (char_length(title) between 1 and 120),
  due_date           date,
  due_odometer_km    integer check (due_odometer_km >= 0),
  lead_days          integer not null default 15 check (lead_days between 0 and 90),
  is_done            boolean not null default false,
  done_on            date,
  insurer            text,
  policy_no          text,
  idv_amount         numeric(12,2) check (idv_amount >= 0),
  premium_amount     numeric(12,2) check (premium_amount >= 0),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint reminders_vehicle_fk foreign key (vehicle_id, user_id)
    references public.vehicles(id, user_id) on delete cascade,
  constraint reminders_has_trigger check (due_date is not null or due_odometer_km is not null)
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','vehicles','fuel_logs','expenses','loans','loan_payments','reminders']
  loop
    execute format('create trigger trg_%I_updated before update on public.%I
                    for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- indexes ----------
create index idx_vehicles_user          on public.vehicles(user_id) where deleted_at is null;
create index idx_expenses_user_date     on public.expenses(user_id, expense_date desc) where deleted_at is null;
create index idx_expenses_vehicle_date  on public.expenses(vehicle_id, expense_date desc) where deleted_at is null;
create index idx_expenses_category      on public.expenses(category_id);
create index idx_fuel_vehicle_odo       on public.fuel_logs(vehicle_id, odometer_km);
create index idx_loans_vehicle          on public.loans(vehicle_id);
create index idx_loan_payments_due      on public.loan_payments(loan_id, due_date);
create index idx_reminders_due          on public.reminders(user_id, due_date) where is_done = false and deleted_at is null;
