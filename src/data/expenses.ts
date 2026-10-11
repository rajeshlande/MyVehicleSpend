import { getSupabase } from './supabase';
import { mapDbError } from './errors';
import type { ExpenseInput, PaymentMode } from '../core/expenses/schema';

export interface Expense {
  id: string;
  vehicleId: string;
  categoryId: string;
  categoryGroup: string;
  categoryName: string;
  expenseDate: string;
  amount: number;
  gstAmount: number;
  paymentMode: PaymentMode | null;
  vendor?: string;
  odometerKm?: number;
  notes?: string;
  receiptPaths: string[];
  source: string;
}

export interface Category {
  id: string;
  groupName: string;
  name: string;
}

interface ExpenseRow {
  id: string;
  vehicle_id: string;
  category_id: string;
  expense_date: string;
  amount: string | number;
  gst_amount: string | number;
  payment_mode: PaymentMode | null;
  vendor: string | null;
  odometer_km: number | null;
  notes: string | null;
  receipt_paths: string[];
  source: string;
  expense_categories: { group_name: string; name: string } | null;
}

const SELECT = '*, expense_categories(group_name,name)';

function toExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    categoryId: r.category_id,
    categoryGroup: r.expense_categories?.group_name ?? '',
    categoryName: r.expense_categories?.name ?? '',
    expenseDate: r.expense_date,
    amount: Number(r.amount),
    gstAmount: Number(r.gst_amount),
    paymentMode: r.payment_mode,
    vendor: r.vendor ?? undefined,
    odometerKm: r.odometer_km ?? undefined,
    notes: r.notes ?? undefined,
    receiptPaths: r.receipt_paths ?? [],
    source: r.source,
  };
}

function toRow(input: ExpenseInput) {
  return {
    vehicle_id: input.vehicleId,
    category_id: input.categoryId,
    expense_date: input.expenseDate,
    amount: input.amount,
    gst_amount: input.gstAmount,
    payment_mode: input.paymentMode,
    vendor: input.vendor ?? null,
    odometer_km: input.odometerKm ?? null,
    notes: input.notes ?? null,
  };
}

/** Live expenses for one vehicle, newest first. */
export async function listExpenses(vehicleId: string): Promise<Expense[]> {
  const { data, error } = await getSupabase()
    .from('expenses')
    .select(SELECT)
    .eq('vehicle_id', vehicleId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw mapDbError(error);
  return (data as unknown as ExpenseRow[]).map(toExpense);
}

/** Creates an expense. The id is generated on the client so offline retries are safe (SDD §7). */
export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data, error } = await getSupabase()
    .from('expenses')
    .insert({ id: crypto.randomUUID(), ...toRow(input), source: 'manual' })
    .select(SELECT)
    .single();
  if (error) throw mapDbError(error);
  return toExpense(data as unknown as ExpenseRow);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
  const { data, error } = await getSupabase()
    .from('expenses')
    .update(toRow(input))
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) throw mapDbError(error);
  return toExpense(data as unknown as ExpenseRow);
}

/** Soft delete (SDD §7). Totals and lists ignore rows with deleted_at set. */
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw mapDbError(error);
}

/** System categories plus the user's own, in a stable order. */
export async function listCategories(): Promise<Category[]> {
  const { data, error } = await getSupabase()
    .from('expense_categories')
    .select('id,group_name,name,sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw mapDbError(error);
  return (data as unknown as { id: string; group_name: string; name: string }[]).map((c) => ({
    id: c.id,
    groupName: c.group_name,
    name: c.name,
  }));
}
