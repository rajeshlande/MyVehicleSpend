-- 0012_reminder_done.sql : mark_reminder_done — T22, FR-REM-03.
-- Marks a reminder done and, when an amount is given, records its expense in the same transaction.
-- The expense takes source 'reminder'. Marking done twice is refused, not repeated.

create or replace function public.mark_reminder_done(
  p_reminder_id uuid, p_done_on date, p_expense_category_id uuid, p_amount numeric,
  p_payment_mode text, p_vendor text, p_notes text
) returns public.reminders
language plpgsql security invoker set search_path = public as $$
declare
  v_rem public.reminders;
begin
  -- RLS applies: another user's reminder is not found.
  select * into v_rem from public.reminders where id = p_reminder_id for update;
  if not found then
    raise exception 'Reminder not found.' using errcode = 'P0002';
  end if;

  if v_rem.is_done then
    raise exception 'This reminder is already done.' using errcode = '22023';
  end if;

  if p_done_on > current_date + 1 then
    raise exception 'The date cannot be more than a day in the future.' using errcode = '22023';
  end if;

  if p_amount is not null then
    if p_amount <= 0 then
      raise exception 'Enter an amount above zero.' using errcode = '22023';
    end if;
    if p_expense_category_id is null then
      raise exception 'Choose a category for the expense.' using errcode = '22023';
    end if;

    insert into public.expenses (id, user_id, vehicle_id, category_id, expense_date, amount,
                                 payment_mode, vendor, notes, source)
    values (gen_random_uuid(), auth.uid(), v_rem.vehicle_id, p_expense_category_id, p_done_on,
            round(p_amount, 2), p_payment_mode, p_vendor, p_notes, 'reminder');
  end if;

  update public.reminders
     set is_done = true, done_on = p_done_on, updated_at = now()
   where id = p_reminder_id
  returning * into v_rem;

  return v_rem;
end $$;

grant execute on function public.mark_reminder_done(uuid, date, uuid, numeric, text, text, text) to authenticated;
