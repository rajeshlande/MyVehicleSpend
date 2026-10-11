import { z } from 'zod';
import { round2 } from '../money/money';
import { todayIST, isFutureBeyondTomorrow } from '../dates/dates';
import { PAYMENT_MODES } from '../expenses/schema';

/** Fuel entry rules (FR-FUEL-01, FR-FUEL-04, FR-FUEL-05). Pure. */

export const MAX_QUANTITY = 200; // litres or kWh in one fill — sanity limit
export const MAX_PRICE_PER_UNIT = 9999.99;

/** Unit for the quantity field: EVs record energy in kWh; everything else in litres. */
export function quantityUnit(fuelType: string): 'kWh' | 'litres' {
  return fuelType === 'ev' ? 'kWh' : 'litres';
}

/** Total paid for a fill, rounded to paise. */
export function fuelTotal(quantity: number, pricePerUnit: number): number {
  return round2(quantity * pricePerUnit);
}

export const fuelInputSchema = z
  .object({
    vehicleId: z.string().uuid('Choose a vehicle.'),
    categoryId: z.string().uuid('Choose a fuel category.'),
    filledOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
      .refine(
        (d) => !isFutureBeyondTomorrow(d, todayIST()),
        'The date cannot be more than a day in the future.'
      ),
    odometerKm: z
      .number({ invalid_type_error: 'Enter the odometer reading.' })
      .int('Odometer must be a whole number.')
      .min(0, 'Odometer cannot be negative.'),
    fuelType: z.enum(['petrol', 'diesel', 'cng', 'lpg', 'ev', 'hybrid']),
    litres: z.number().optional(),
    energyKwh: z.number().optional(),
    pricePerUnit: z
      .number({ invalid_type_error: 'Enter the price per unit.' })
      .positive('Price must be more than 0.')
      .max(MAX_PRICE_PER_UNIT, 'Price looks too high. Check the amount.'),
    isFullTank: z.boolean().default(true),
    station: z
      .string()
      .trim()
      .max(80, 'Station must be 80 characters or fewer.')
      .optional()
      .transform((v) => (v ? v : undefined)),
    paymentMode: z.enum(PAYMENT_MODES).optional(),
  })
  .superRefine((v, ctx) => {
    if (quantityUnit(v.fuelType) === 'kWh') {
      if (v.energyKwh === undefined) {
        ctx.addIssue({ code: 'custom', path: ['energyKwh'], message: 'Enter the energy in kWh.' });
      } else if (!(v.energyKwh > 0 && v.energyKwh <= MAX_QUANTITY)) {
        ctx.addIssue({
          code: 'custom',
          path: ['energyKwh'],
          message: `kWh must be more than 0 and at most ${MAX_QUANTITY}.`,
        });
      }
      if (v.litres !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['litres'], message: 'EVs record kWh, not litres.' });
      }
    } else {
      if (v.litres === undefined) {
        ctx.addIssue({ code: 'custom', path: ['litres'], message: 'Enter the litres.' });
      } else if (!(v.litres > 0 && v.litres <= MAX_QUANTITY)) {
        ctx.addIssue({
          code: 'custom',
          path: ['litres'],
          message: `Litres must be more than 0 and at most ${MAX_QUANTITY}.`,
        });
      }
      if (v.energyKwh !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['energyKwh'], message: 'Only EVs record kWh.' });
      }
    }
  });

export type FuelInput = z.infer<typeof fuelInputSchema>;
