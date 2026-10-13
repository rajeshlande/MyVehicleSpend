-- 0015_service_bills.sql : service bills for a vehicle (Invoice module, vehicle scope).
-- A bill is what a garage or service centre charges for work on one vehicle. Customer billing
-- is not in scope. create_service_bill stores a bill and its lines in one transaction and computes
-- every amount on the server, so the client cannot store a total that does not add up.
-- Idempotent by client id (same pattern as create_loan).

create table public.service_bills (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id  uuid not null,
  bill_no     text not null check (char_length(bill_no) between 1 and 40),
  vendor      text not null check (char_length(vendor) between 1 and 120),
  issue_date  date not null,
  due_date    date,
  status      text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  subtotal    numeric(12,2) not null check (subtotal >= 0),
  tax         numeric(12,2) not null default 0 check (tax >= 0),
  total       numeric(12,2) not null check (total >= 0),
  notes       text check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  constraint service_bills_sum_check check (total = subtotal + tax),
  constraint service_bills_due_check check (due_date is null or due_date >= issue_date),
  constraint service_bills_number_unique unique (user_id, bill_no),
  constraint service_bills_vehicle_fk foreign key (vehicle_id, user_id)
    references public.vehicles(id, user_id) on delete cascade
);

create table public.service_bill_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bill_id     uuid not null references public.service_bills(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  quantity    numeric(10,2) not null check (quantity > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  amount      numeric(12,2) not null check (amount >= 0),
  constraint service_bill_items_line_check check (amount = round(quantity * unit_price, 2))
);

alter table public.service_bills       enable row level security;
alter table public.service_bill_items  enable row level security;

-- Owner-only policies, the same pattern as the other user-owned tables (0002).
create policy "service_bills own select" on public.service_bills for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "service_bills own insert" on public.service_bills for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "service_bills own update" on public.service_bills for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "service_bills own delete" on public.service_bills for delete
  to authenticated using ((select auth.uid()) = user_id);

create policy "service_bill_items own select" on public.service_bill_items for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "service_bill_items own insert" on public.service_bill_items for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "service_bill_items own update" on public.service_bill_items for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "service_bill_items own delete" on public.service_bill_items for delete
  to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.service_bills, public.service_bill_items to authenticated;

create or replace function public.create_service_bill(
  p_id uuid,
  p_vehicle_id uuid,
  p_bill_no text,
  p_vendor text,
  p_issue_date date,
  p_due_date date,
  p_tax numeric,
  p_notes text,
  p_items jsonb
) returns public.service_bills
language plpgsql security invoker set search_path = public as $$
declare
  v_row public.service_bills;
  v_subtotal numeric := 0;
  v_count integer;
begin
  -- Idempotency: a retry with the same client id returns the existing bill and writes nothing.
  select * into v_row from public.service_bills where id = p_id;
  if found then
    return v_row;
  end if;

  select count(*) into v_count from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if v_count = 0 then
    raise exception 'A bill needs at least one item.' using errcode = '22023';
  end if;

  if p_due_date is not null and p_due_date < p_issue_date then
    raise exception 'The due date cannot be before the issue date.' using errcode = '22023';
  end if;

  select coalesce(sum(round((i->>'quantity')::numeric * (i->>'unit_price')::numeric, 2)), 0)
    into v_subtotal
    from jsonb_array_elements(p_items) as i;

  insert into public.service_bills (id, user_id, vehicle_id, bill_no, vendor, issue_date, due_date,
                                    subtotal, tax, total, notes)
  values (p_id, auth.uid(), p_vehicle_id, p_bill_no, p_vendor, p_issue_date, p_due_date,
          v_subtotal, coalesce(p_tax, 0), v_subtotal + coalesce(p_tax, 0), p_notes)
  returning * into v_row;

  insert into public.service_bill_items (user_id, bill_id, description, quantity, unit_price, amount)
  select auth.uid(), p_id,
         i->>'description',
         (i->>'quantity')::numeric,
         (i->>'unit_price')::numeric,
         round((i->>'quantity')::numeric * (i->>'unit_price')::numeric, 2)
    from jsonb_array_elements(p_items) as i;

  return v_row;
end $$;

grant execute on function public.create_service_bill(uuid, uuid, text, text, date, date, numeric,
                                                     text, jsonb) to authenticated;
