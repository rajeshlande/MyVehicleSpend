import { getSupabase } from './supabase';
import { mapDbError } from './errors';
import type { FuelType, VehicleInput, VehicleType } from '../core/vehicles/schema';

/** Vehicle as used in the UI (camelCase). */
export interface Vehicle {
  id: string;
  vehicleType: VehicleType;
  registrationNo: string;
  make?: string;
  model?: string;
  variant?: string;
  fuelType: FuelType;
  purchaseDate?: string;
  purchasePrice?: number;
  startOdometerKm: number;
  isArchived: boolean;
}

interface VehicleRow {
  id: string;
  vehicle_type: VehicleType;
  registration_no: string;
  make: string | null;
  model: string | null;
  variant: string | null;
  fuel_type: FuelType;
  purchase_date: string | null;
  purchase_price: string | number | null;
  start_odometer_km: number;
  is_archived: boolean;
}

const COLUMNS =
  'id,vehicle_type,registration_no,make,model,variant,fuel_type,purchase_date,purchase_price,start_odometer_km,is_archived';

function toVehicle(r: VehicleRow): Vehicle {
  return {
    id: r.id,
    vehicleType: r.vehicle_type,
    registrationNo: r.registration_no,
    make: r.make ?? undefined,
    model: r.model ?? undefined,
    variant: r.variant ?? undefined,
    fuelType: r.fuel_type,
    purchaseDate: r.purchase_date ?? undefined,
    purchasePrice: r.purchase_price == null ? undefined : Number(r.purchase_price),
    startOdometerKm: r.start_odometer_km,
    isArchived: r.is_archived,
  };
}

function toRow(input: VehicleInput & { isArchived?: boolean }) {
  return {
    vehicle_type: input.vehicleType,
    registration_no: input.registrationNo,
    make: input.make ?? null,
    model: input.model ?? null,
    variant: input.variant ?? null,
    fuel_type: input.fuelType,
    purchase_date: input.purchaseDate ?? null,
    purchase_price: input.purchasePrice ?? null,
    start_odometer_km: input.startOdometerKm,
    ...(input.isArchived === undefined ? {} : { is_archived: input.isArchived }),
  };
}

/** Live (not deleted) vehicles of the signed-in user, oldest first. RLS limits rows to the user. */
export async function listVehicles(): Promise<Vehicle[]> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .select(COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw mapDbError(error);
  return (data as unknown as VehicleRow[]).map(toVehicle);
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .insert(toRow(input))
    .select(COLUMNS)
    .single();
  if (error) throw mapDbError(error);
  return toVehicle(data as unknown as VehicleRow);
}

export async function updateVehicle(
  id: string,
  input: VehicleInput & { isArchived: boolean },
): Promise<Vehicle> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .update(toRow(input))
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) throw mapDbError(error);
  return toVehicle(data as unknown as VehicleRow);
}

/** Soft-deletes the vehicle and its linked rows in one transaction (migration 0006). */
export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_vehicle', { p_vehicle_id: id });
  if (error) throw mapDbError(error);
}
