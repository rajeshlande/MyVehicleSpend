-- 0010_loans.sql : create_loan stores a loan and its whole schedule in one transaction — T18, FR-LOAN-01, FR-LOAN-03.
-- Idempotent by client id (same pattern as add_fuel_log). The database re-checks the schedule the client built:
-- row count = tenure, principal components sum to the loan amount, final closing balance = 0.
-- Closing a loan needs no RPC: it is an update to loans.status, allowed by the existing RLS policy.

create or replace function public.create_loan(
  p_id uuid, p_vehicle_id uuid, p_lender text, p_account_last4 text,
  p_principal numeric, p_annual_rate numeric, p_tenure_months integer, p_start_date date,
  p_emi numeric, p_interest_method text, p_processing_fee numeric, p_other_charges numeric,
  p_schedule jsonb
) returns public.loans
language plpgsql security invoker set search_path = public as $$
declare
  v_row public.loans;
  v_count integer;
  v_principal_sum numeric;
  v_final_balance numeric;
begin
  -- Idempotency: a retry with the same client id returns the existing loan and writes nothing.
  select * into v_row from public.loans where id = p_id;
  if found then
    return v_row;
  end if;

  select count(*), coalesce(sum((r->>'principal_component')::numeric), 0)
    into v_count, v_principal_sum
    from jsonb_array_elements(p_schedule) as r;

  if v_count <> p_tenure_months then
    raise exception 'Schedule has % rows but the tenure is % months.', v_count, p_tenure_months
      using errcode = '22023';
  end if;

  if abs(v_principal_sum - p_principal) > 0.01 then
    raise exception 'Schedule principal does not add up to the loan amount.' using errcode = '22023';
  end if;

  select (r->>'closing_balance')::numeric into v_final_balance
    from jsonb_array_elements(p_schedule) as r
    where (r->>'installment_no')::integer = p_tenure_months;

  if coalesce(v_final_balance, -1) <> 0 then
    raise exception 'Schedule does not clear the loan by the final instalment.' using errcode = '22023';
  end if;

  insert into public.loans (id, user_id, vehicle_id, lender, account_last4, principal, annual_rate,
                            tenure_months, start_date, emi_amount, interest_method,
                            processing_fee, other_charges)
  values (p_id, auth.uid(), p_vehicle_id, p_lender, p_account_last4, p_principal, p_annual_rate,
          p_tenure_months, p_start_date, p_emi, p_interest_method, p_processing_fee, p_other_charges)
  returning * into v_row;

  insert into public.loan_payments (user_id, loan_id, installment_no, due_date, scheduled_emi,
                                    principal_component, interest_component,
                                    opening_balance, closing_balance)
  select auth.uid(), p_id,
         (r->>'installment_no')::integer,
         (r->>'due_date')::date,
         (r->>'scheduled_emi')::numeric,
         (r->>'principal_component')::numeric,
         (r->>'interest_component')::numeric,
         (r->>'opening_balance')::numeric,
         (r->>'closing_balance')::numeric
    from jsonb_array_elements(p_schedule) as r;

  return v_row;
end $$;

grant execute on function public.create_loan(uuid, uuid, text, text, numeric, numeric, integer, date,
                                             numeric, text, numeric, numeric, jsonb) to authenticated;
