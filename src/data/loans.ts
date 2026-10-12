import { getSupabase } from './supabase';
import { mapDbError } from './errors';
import type { LoanInput } from '../core/loans/schema';
import type { DatedRow } from '../core/loans/plan';

/** Loan as used in the UI (camelCase). */
export interface Loan {
  id: string;
  vehicleId: string;
  lender: string;
  accountLast4?: string;
  principal: number;
  annualRate: number;
  tenureMonths: number;
  startDate: string;
  emiAmount: number;
  interestMethod: 'reducing' | 'flat';
  processingFee: number;
  otherCharges: number;
  status: 'active' | 'closed';
  closedOn?: string;
}

/** One schedule row as stored (loan_payments). */
export interface LoanPayment {
  id: string;
  installmentNo: number;
  dueDate: string;
  scheduledEmi: number;
  principalComponent: number;
  interestComponent: number;
  openingBalance: number;
  closingBalance: number;
  status: 'scheduled' | 'paid' | 'late' | 'waived';
  paidOn?: string;
  paidAmount?: number;
  lateFee: number;
  bounceCharge: number;
}

interface LoanRow {
  id: string;
  vehicle_id: string;
  lender: string;
  account_last4: string | null;
  principal: string | number;
  annual_rate: string | number;
  tenure_months: number;
  start_date: string;
  emi_amount: string | number;
  interest_method: 'reducing' | 'flat';
  processing_fee: string | number;
  other_charges: string | number;
  status: 'active' | 'closed';
  closed_on: string | null;
}

interface PaymentRow {
  id: string;
  installment_no: number;
  due_date: string;
  scheduled_emi: string | number;
  principal_component: string | number;
  interest_component: string | number;
  opening_balance: string | number;
  closing_balance: string | number;
  status: LoanPayment['status'];
  paid_on: string | null;
  paid_amount: string | number | null;
  late_fee: string | number;
  bounce_charge: string | number;
}

const LOAN_COLUMNS =
  'id,vehicle_id,lender,account_last4,principal,annual_rate,tenure_months,start_date,emi_amount,interest_method,processing_fee,other_charges,status,closed_on';
const PAYMENT_COLUMNS =
  'id,installment_no,due_date,scheduled_emi,principal_component,interest_component,opening_balance,closing_balance,status,paid_on,paid_amount,late_fee,bounce_charge';

function toLoan(r: LoanRow): Loan {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    lender: r.lender,
    accountLast4: r.account_last4 ?? undefined,
    principal: Number(r.principal),
    annualRate: Number(r.annual_rate),
    tenureMonths: r.tenure_months,
    startDate: r.start_date,
    emiAmount: Number(r.emi_amount),
    interestMethod: r.interest_method,
    processingFee: Number(r.processing_fee),
    otherCharges: Number(r.other_charges),
    status: r.status,
    closedOn: r.closed_on ?? undefined,
  };
}

function toPayment(r: PaymentRow): LoanPayment {
  return {
    id: r.id,
    installmentNo: r.installment_no,
    dueDate: r.due_date,
    scheduledEmi: Number(r.scheduled_emi),
    principalComponent: Number(r.principal_component),
    interestComponent: Number(r.interest_component),
    openingBalance: Number(r.opening_balance),
    closingBalance: Number(r.closing_balance),
    status: r.status,
    paidOn: r.paid_on ?? undefined,
    paidAmount: r.paid_amount == null ? undefined : Number(r.paid_amount),
    lateFee: Number(r.late_fee),
    bounceCharge: Number(r.bounce_charge),
  };
}

/** Live loans for one vehicle: active first, then closed; newest start date first. */
export async function listLoans(vehicleId: string): Promise<Loan[]> {
  const { data, error } = await getSupabase()
    .from('loans')
    .select(LOAN_COLUMNS)
    .eq('vehicle_id', vehicleId)
    .is('deleted_at', null)
    .order('start_date', { ascending: false });
  if (error) throw mapDbError(error);
  return (data as unknown as LoanRow[]).map(toLoan);
}

/** Schedule rows for one loan, in instalment order. */
export async function listLoanPayments(loanId: string): Promise<LoanPayment[]> {
  const { data, error } = await getSupabase()
    .from('loan_payments')
    .select(PAYMENT_COLUMNS)
    .eq('loan_id', loanId)
    .order('installment_no', { ascending: true });
  if (error) throw mapDbError(error);
  return (data as unknown as PaymentRow[]).map(toPayment);
}

/** Stores a loan and its schedule in one call (create_loan, migration 0010). The client id makes retries safe. */
export async function createLoan(
  input: LoanInput,
  plan: { emi: number; tenureMonths: number; rows: DatedRow[] }
): Promise<Loan> {
  const schedule = plan.rows.map((r) => ({
    installment_no: r.no,
    due_date: r.dueDate,
    scheduled_emi: r.emi,
    principal_component: r.principal,
    interest_component: r.interest,
    opening_balance: r.openingBalance,
    closing_balance: r.closingBalance,
  }));
  const { data, error } = await getSupabase().rpc('create_loan', {
    p_id: crypto.randomUUID(),
    p_vehicle_id: input.vehicleId,
    p_lender: input.lender,
    p_account_last4: input.accountLast4 ?? null,
    p_principal: input.principal,
    p_annual_rate: input.annualRatePct,
    p_tenure_months: plan.tenureMonths,
    p_start_date: input.startDate,
    p_emi: plan.emi,
    p_interest_method: input.interestMethod,
    p_processing_fee: input.processingFee,
    p_other_charges: input.otherCharges,
    p_schedule: schedule,
  });
  if (error) throw mapDbError(error);
  return toLoan(data as unknown as LoanRow);
}

/** Marks a loan closed (FR-LOAN-11). The schedule is kept; the loan stays viewable. */
export async function closeLoan(loanId: string, closedOn: string): Promise<void> {
  const { error } = await getSupabase()
    .from('loans')
    .update({ status: 'closed', closed_on: closedOn })
    .eq('id', loanId);
  if (error) throw mapDbError(error);
}

/** One live loan by id, or null when it does not exist or is not visible to this user. */
export async function getLoan(loanId: string): Promise<Loan | null> {
  const { data, error } = await getSupabase()
    .from('loans')
    .select(LOAN_COLUMNS)
    .eq('id', loanId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw mapDbError(error);
  return data ? toLoan(data as unknown as LoanRow) : null;
}

/** Records one EMI payment and its expense in one call (record_loan_payment, migration 0011). */
export async function recordLoanPayment(
  paymentId: string,
  categoryId: string,
  input: {
    paidOn: string;
    lateFee: number;
    bounceCharge: number;
    paymentMode?: string;
    notes?: string;
  }
): Promise<LoanPayment> {
  const { data, error } = await getSupabase().rpc('record_loan_payment', {
    p_payment_id: paymentId,
    p_category_id: categoryId,
    p_paid_on: input.paidOn,
    p_late_fee: input.lateFee,
    p_bounce_charge: input.bounceCharge,
    p_payment_mode: input.paymentMode ?? null,
    p_notes: input.notes?.trim() ? input.notes.trim() : null,
  });
  if (error) throw mapDbError(error);
  return toPayment(data as unknown as PaymentRow);
}
