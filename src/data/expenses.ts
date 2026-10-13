import { readThrough } from './offlineCache';
import { getSupabase } from './supabase';
import { mapDbError } from './errors';
import { saveOrQueue } from './writes';
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
  /** True for a provisional row shown while the save waits in the outbox (T29b). */
  pending?: boolean;
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
async function fetchExpenses(vehicleId: string): Promise<Expense[]> {
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

/** Read with the offline cache: live when online, last saved copy when the connection fails (FR-PWA-03). */
export function listExpenses(vehicleId: string): Promise<Expense[]> {
  return readThrough(`expenses|${vehicleId}`, () => fetchExpenses(vehicleId));
}

/**
 * Creates an expense with a client-made id (SDD §7). The add_expense RPC is idempotent by that id,
 * so an outbox replay after a dropped response returns the same row and creates nothing (T29c).
 */
export async function createExpenseWithId(id: string, input: ExpenseInput): Promise<Expense> {
  const { error } = await getSupabase().rpc('add_expense', {
    p_id: id,
    p_vehicle_id: input.vehicleId,
    p_category_id: input.categoryId,
    p_expense_date: input.expenseDate,
    p_amount: input.amount,
    p_gst_amount: input.gstAmount,
    p_payment_mode: input.paymentMode,
    p_vendor: input.vendor ?? null,
    p_odometer_km: input.odometerKm ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw mapDbError(error);
  // Re-read with the category join, so the row matches what the lists show.
  const { data, error: readError } = await getSupabase()
    .from('expenses')
    .select(SELECT)
    .eq('id', id)
    .single();
  if (readError) throw mapDbError(readError);
  return toExpense(data as unknown as ExpenseRow);
}

/** Saves an expense, or queues it when offline. A queued save returns a provisional row marked pending. */
export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const id = crypto.randomUUID();
  return saveOrQueue({
    op: 'expense.create',
    id,
    payload: input,
    send: () => createExpenseWithId(id, input),
    provisional: (): Expense => ({
      id,
      vehicleId: input.vehicleId,
      categoryId: input.categoryId,
      categoryGroup: '',
      categoryName: '',
      expenseDate: input.expenseDate,
      amount: input.amount,
      gstAmount: input.gstAmount,
      paymentMode: input.paymentMode ?? null,
      vendor: input.vendor ?? undefined,
      odometerKm: input.odometerKm ?? undefined,
      notes: input.notes ?? undefined,
      receiptPaths: [],
      source: 'manual',
      pending: true,
    }),
  });
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
async function fetchCategories(): Promise<Category[]> {
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

/** Read with the offline cache: live when online, last saved copy when the connection fails (FR-PWA-03). */
export function listCategories(): Promise<Category[]> {
  return readThrough(`categories`, () => fetchCategories());
}

/** Replaces the receipt paths on one expense (T14). The bucket is private; paths are not URLs. */
export async function setReceiptPaths(expenseId: string, paths: string[]): Promise<void> {
  const { error } = await getSupabase()
    .from('expenses')
    .update({ receipt_paths: paths })
    .eq('id', expenseId);
  if (error) throw mapDbError(error);
}
