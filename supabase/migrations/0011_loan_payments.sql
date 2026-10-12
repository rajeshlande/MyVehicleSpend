-- 0011_loan_payments.sql : record_loan_payment — T19, FR-LOAN-05, FR-LOAN-09.
-- Marks one schedule row paid and creates its expense (EMI payment category) in one transaction.
-- Expense amount = scheduled EMI + late fee + bounce charge. The interest component stays on the schedule row.
-- Late is not stored: the app derives it from the due date (see src/core/loans/payment.ts).

create or replace function public.record_loan_payment(
  p_payment_id uuid, p_category_id uuid, p_paid_on date,
  p_late_fee numeric, p_bounce_charge numeric, p_payment_mode text, p_notes text
) returns public.loan_payments
language plpgsql security invoker set search_path = public as $$
declare
  v_pay public.loan_payments;
  v_loan public.loans;
  v_total numeric(12,2);
  v_expense_id uuid := gen_random_uuid();
begin
  -- RLS applies: another user's instalment is not found.
  select * into v_pay from public.loan_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Instalment not found.' using errcode = 'P0002';
  end if;

  if v_pay.status = 'paid' then
    raise exception 'This instalment is already recorded as paid.' using errcode = '22023';
  end if;
  if v_pay.status = 'waived' then
    raise exception 'This instalment was waived.' using errcode = '22023';
  end if;

  if p_paid_on > current_date + 1 then
    raise exception 'The date cannot be more than a day in the future.' using errcode = '22023';
  end if;

  select * into v_loan from public.loans where id = v_pay.loan_id;

  v_total := round(v_pay.scheduled_emi + coalesce(p_late_fee, 0) + coalesce(p_bounce_charge, 0), 2);

  insert into public.expenses (id, user_id, vehicle_id, category_id, expense_date, amount,
                               payment_mode, vendor, notes, source)
  values (v_expense_id, auth.uid(), v_loan.vehicle_id, p_category_id, p_paid_on, v_total,
          p_payment_mode, v_loan.lender, p_notes, 'loan');

  update public.loan_payments
     set status = 'paid',
         paid_on = p_paid_on,
         paid_amount = v_total,
         late_fee = coalesce(p_late_fee, 0),
         bounce_charge = coalesce(p_bounce_charge, 0),
         expense_id = v_expense_id,
         notes = coalesce(p_notes, notes),
         updated_at = now()
   where id = p_payment_id
  returning * into v_pay;

  return v_pay;
end $$;

grant execute on function public.record_loan_payment(uuid, uuid, date, numeric, numeric, text, text) to authenticated;
