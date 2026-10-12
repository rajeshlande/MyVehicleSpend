import { readThrough } from './offlineCache';
import { getSupabase } from './supabase';
import { mapDbError } from './errors';
import type { FuelInput } from '../core/fuel/schema';

/** Fuel fill as used in the UI (camelCase). `litres` is null for EV fills; `energyKwh` for EVs only. */
export interface FuelLog {
  id: string;
  vehicleId: string;
  expenseId?: string;
  filledOn: string;
  odometerKm: number;
  litres?: number;
  energyKwh?: number;
  pricePerUnit: number;
  totalAmount: number;
  isFullTank: boolean;
  station?: string;
  paymentMode?: string;
}

interface FuelRow {
  id: string;
  vehicle_id: string;
  expense_id: string | null;
  filled_on: string;
  odometer_km: number;
  litres: string | number | null;
  energy_kwh: string | number | null;
  price_per_unit: string | number;
  total_amount: string | number;
  is_full_tank: boolean;
  station: string | null;
  payment_mode: string | null;
}

const COLUMNS =
  'id,vehicle_id,expense_id,filled_on,odometer_km,litres,energy_kwh,price_per_unit,total_amount,is_full_tank,station,payment_mode';

function toFuelLog(r: FuelRow): FuelLog {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    expenseId: r.expense_id ?? undefined,
    filledOn: r.filled_on,
    odometerKm: r.odometer_km,
    litres: r.litres == null ? undefined : Number(r.litres),
    energyKwh: r.energy_kwh == null ? undefined : Number(r.energy_kwh),
    pricePerUnit: Number(r.price_per_unit),
    totalAmount: Number(r.total_amount),
    isFullTank: r.is_full_tank,
    station: r.station ?? undefined,
    paymentMode: r.payment_mode ?? undefined,
  };
}

/** Live fuel fills for one vehicle, newest first. */
async function fetchFuelLogs(vehicleId: string): Promise<FuelLog[]> {
  const { data, error } = await getSupabase()
    .from('fuel_logs')
    .select(COLUMNS)
    .eq('vehicle_id', vehicleId)
    .is('deleted_at', null)
    .order('filled_on', { ascending: false })
    .order('odometer_km', { ascending: false });
  if (error) throw mapDbError(error);
  return (data as unknown as FuelRow[]).map(toFuelLog);
}

/** Read with the offline cache: live when online, last saved copy when the connection fails (FR-PWA-03). */
export function listFuelLogs(vehicleId: string): Promise<FuelLog[]> {
  return readThrough(`fuel|${vehicleId}`, () => fetchFuelLogs(vehicleId));
}

/**
 * Logs a fill and its expense in one call (add_fuel_log, migration 0009).
 * The client id makes retries safe (TC-PWA-05).
 */
export async function addFuelLog(input: FuelInput & { categoryId: string }): Promise<FuelLog> {
  const { data, error } = await getSupabase().rpc('add_fuel_log', {
    p_id: crypto.randomUUID(),
    p_vehicle_id: input.vehicleId,
    p_filled_on: input.filledOn,
    p_odometer_km: input.odometerKm,
    p_litres: input.litres ?? null,
    p_price_per_litre: input.pricePerUnit,
    p_is_full_tank: input.isFullTank,
    p_station: input.station ?? null,
    p_payment_mode: input.paymentMode ?? null,
    p_category_id: input.categoryId,
    p_energy_kwh: input.energyKwh ?? null,
  });
  if (error) throw mapDbError(error);
  return toFuelLog(data as unknown as FuelRow);
}
