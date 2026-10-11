import { z } from 'zod';
import { isValidRegistration, normalizeRegistration } from './registration';

export const VEHICLE_TYPES = ['car', 'bike', 'scooter', 'other'] as const;
export const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'lpg', 'ev', 'hybrid'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type FuelType = (typeof FUEL_TYPES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Validates and normalises a vehicle entered in the UI (FR-VEH-01). */
export const vehicleInputSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES, { errorMap: () => ({ message: 'Choose a vehicle type.' }) }),
  registrationNo: z
    .string()
    .transform(normalizeRegistration)
    .refine(isValidRegistration, 'Registration number must be 4–12 letters or digits, e.g. MH12AB1234.'),
  make: optionalText(40),
  model: optionalText(60),
  variant: optionalText(60),
  fuelType: z.enum(FUEL_TYPES, { errorMap: () => ({ message: 'Choose a fuel type.' }) }),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
    .optional()
    .transform((v) => (v ? v : undefined)),
  purchasePrice: z.number().min(0, 'Price cannot be negative.').optional(),
  startOdometerKm: z
    .number({ invalid_type_error: 'Enter the odometer reading in km.' })
    .int('Odometer must be a whole number.')
    .min(0, 'Odometer cannot be negative.')
    .max(2_000_000, 'Odometer looks too high.'),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;
