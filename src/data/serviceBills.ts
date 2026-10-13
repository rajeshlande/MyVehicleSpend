import { readThrough } from './offlineCache';
import { getSupabase } from './supabase';
import { mapDbError } from './errors';
import type { ServiceBillInput } from '../core/bills/bill';

/** Service bill as used in the UI (camelCase). Invoice module, vehicle scope (migration 0015). */
export interface ServiceBillLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ServiceBill {
  id: string;
  vehicleId: string;
  billNo: string;
  vendor: string;
  issueDate: string;
  dueDate?: string;
  status: 'unpaid' | 'paid';
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  lines: ServiceBillLine[];
}

interface LineRow {
  id: string;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  amount: number | string;
}

interface BillRow {
  id: string;
  vehicle_id: string;
  bill_no: string;
  vendor: string;
  issue_date: string;
  due_date: string | null;
  status: 'unpaid' | 'paid';
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  notes: string | null;
  service_bill_items?: LineRow[];
}

function toBill(row: BillRow): ServiceBill {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    billNo: row.bill_no,
    vendor: row.vendor,
    issueDate: row.issue_date,
    dueDate: row.due_date ?? undefined,
    status: row.status,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    notes: row.notes ?? undefined,
    lines: (row.service_bill_items ?? []).map((l) => ({
      id: l.id,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      amount: Number(l.amount),
    })),
  };
}

async function fetchServiceBills(vehicleId: string): Promise<ServiceBill[]> {
  const { data, error } = await getSupabase()
    .from('service_bills')
    .select('*, service_bill_items(*)')
    .eq('vehicle_id', vehicleId)
    .order('issue_date', { ascending: false });
  if (error) throw mapDbError(error);
  return ((data ?? []) as unknown as BillRow[]).map(toBill);
}

/** Bills for a vehicle, newest first. Cached for offline reading, like the other lists. */
export function listServiceBills(vehicleId: string): Promise<ServiceBill[]> {
  return readThrough(`serviceBills|${vehicleId}`, () => fetchServiceBills(vehicleId));
}

/**
 * Stores a bill and its lines through create_service_bill. The database computes every amount,
 * so the client sends only quantities and unit prices. The random id makes a retry safe.
 */
export async function createServiceBill(input: ServiceBillInput): Promise<{ id: string }> {
  const { data, error } = await getSupabase().rpc('create_service_bill', {
    p_id: crypto.randomUUID(),
    p_vehicle_id: input.vehicleId,
    p_bill_no: input.billNo,
    p_vendor: input.vendor,
    p_issue_date: input.issueDate,
    p_due_date: input.dueDate ?? null,
    p_tax: input.tax,
    p_notes: input.notes ?? null,
    p_items: input.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unitPrice,
    })),
  });
  if (error) throw mapDbError(error);
  return { id: (data as unknown as { id: string }).id };
}

/** Marks a bill paid. Row-level security limits this to the owner's own bills. */
export async function markServiceBillPaid(billId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('service_bills')
    .update({ status: 'paid' })
    .eq('id', billId);
  if (error) throw mapDbError(error);
}
