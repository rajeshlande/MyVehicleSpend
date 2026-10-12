import { readThrough } from './offlineCache';
import { getSupabase } from './supabase';
import { mapDbError } from './errors';
import type { ReminderInput, ReminderType } from '../core/reminders/schema';

/** Reminder as used in the UI (camelCase). */
export interface Reminder {
  id: string;
  vehicleId: string;
  reminderType: ReminderType;
  title: string;
  dueDate?: string;
  dueOdometerKm?: number;
  leadDays: number;
  isDone: boolean;
  doneOn?: string;
  insurer?: string;
  policyNo?: string;
  idvAmount?: number;
  premiumAmount?: number;
  notes?: string;
}

interface ReminderRow {
  id: string;
  vehicle_id: string;
  reminder_type: ReminderType;
  title: string;
  due_date: string | null;
  due_odometer_km: number | null;
  lead_days: number;
  is_done: boolean;
  done_on: string | null;
  insurer: string | null;
  policy_no: string | null;
  idv_amount: string | number | null;
  premium_amount: string | number | null;
  notes: string | null;
}

const COLUMNS =
  'id,vehicle_id,reminder_type,title,due_date,due_odometer_km,lead_days,is_done,done_on,insurer,policy_no,idv_amount,premium_amount,notes';

const num = (v: string | number | null) => (v == null ? undefined : Number(v));

function toReminder(r: ReminderRow): Reminder {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    reminderType: r.reminder_type,
    title: r.title,
    dueDate: r.due_date ?? undefined,
    dueOdometerKm: r.due_odometer_km ?? undefined,
    leadDays: r.lead_days,
    isDone: r.is_done,
    doneOn: r.done_on ?? undefined,
    insurer: r.insurer ?? undefined,
    policyNo: r.policy_no ?? undefined,
    idvAmount: num(r.idv_amount),
    premiumAmount: num(r.premium_amount),
    notes: r.notes ?? undefined,
  };
}

/** Columns written on create and update. Blank optional text is stored as null. */
function toRow(input: ReminderInput) {
  const blank = (s?: string) => (s && s.trim() ? s.trim() : null);
  return {
    vehicle_id: input.vehicleId,
    reminder_type: input.reminderType,
    title: input.title.trim(),
    due_date: input.dueDate ?? null,
    due_odometer_km: input.dueOdometerKm ?? null,
    lead_days: input.leadDays,
    insurer: blank(input.insurer),
    policy_no: blank(input.policyNo),
    idv_amount: input.idvAmount ?? null,
    premium_amount: input.premiumAmount ?? null,
    notes: blank(input.notes),
  };
}

/** Live reminders for one vehicle, earliest due date first (undated km reminders last). */
async function fetchReminders(vehicleId: string): Promise<Reminder[]> {
  const { data, error } = await getSupabase()
    .from('reminders')
    .select(COLUMNS)
    .eq('vehicle_id', vehicleId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw mapDbError(error);
  return (data as unknown as ReminderRow[]).map(toReminder);
}

/** Read with the offline cache: live when online, last saved copy when the connection fails (FR-PWA-03). */
export function listReminders(vehicleId: string): Promise<Reminder[]> {
  return readThrough(`reminders|${vehicleId}`, () => fetchReminders(vehicleId));
}

export async function createReminder(input: ReminderInput): Promise<Reminder> {
  const { data, error } = await getSupabase()
    .from('reminders')
    .insert(toRow(input))
    .select(COLUMNS)
    .single();
  if (error) throw mapDbError(error);
  return toReminder(data as unknown as ReminderRow);
}

export async function updateReminder(id: string, input: ReminderInput): Promise<Reminder> {
  const { data, error } = await getSupabase()
    .from('reminders')
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) throw mapDbError(error);
  return toReminder(data as unknown as ReminderRow);
}

/** Soft delete: the reminder is hidden everywhere but kept in the database. */
export async function deleteReminder(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('reminders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw mapDbError(error);
}

/**
 * Marks a reminder done, and records its expense when `recordExpense` is set (mark_reminder_done, migration 0012).
 * Both happen in one call, so a failure leaves neither half-saved.
 */
export async function markReminderDone(
  id: string,
  input: {
    doneOn: string;
    recordExpense: boolean;
    amount?: number;
    categoryId?: string;
    paymentMode?: string;
    vendor?: string;
    notes?: string;
  }
): Promise<Reminder> {
  const { data, error } = await getSupabase().rpc('mark_reminder_done', {
    p_reminder_id: id,
    p_done_on: input.doneOn,
    p_expense_category_id: input.recordExpense ? (input.categoryId ?? null) : null,
    p_amount: input.recordExpense ? (input.amount ?? null) : null,
    p_payment_mode: input.recordExpense ? (input.paymentMode ?? null) : null,
    p_vendor: input.recordExpense && input.vendor?.trim() ? input.vendor.trim() : null,
    p_notes: input.recordExpense && input.notes?.trim() ? input.notes.trim() : null,
  });
  if (error) throw mapDbError(error);
  return toReminder(data as unknown as ReminderRow);
}
