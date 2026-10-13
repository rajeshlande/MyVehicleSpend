import { z } from 'zod';
import { MAX_EXPENSE_AMOUNT, round2, sumMoney } from '../money/money';

/** Service bill rules (Invoice module, vehicle scope). Pure: no network, no storage. */

export interface BillLine {
  quantity: number;
  unitPrice: number;
}

export interface BillTotals {
  /** Each line's amount, rounded to paise. Same order as the input. */
  lines: number[];
  subtotal: number;
  total: number;
}

/** Line amounts and totals in whole paise, so 2 × ₹150.50 is exact. Mirrors the database. */
export function computeTotals(items: readonly BillLine[], tax: number): BillTotals {
  const lines = items.map((i) => round2(i.quantity * i.unitPrice));
  const subtotal = sumMoney(lines);
  return { lines, subtotal, total: round2(subtotal + tax) };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const serviceBillSchema = z
  .object({
    vehicleId: z.string().uuid('Choose a vehicle.'),
    billNo: z
      .string()
      .trim()
      .min(1, 'Enter the bill number.')
      .max(40, 'Keep the bill number under 40 characters.'),
    vendor: z
      .string()
      .trim()
      .min(1, 'Enter the garage or service centre name.')
      .max(120, 'Keep the name under 120 characters.'),
    issueDate: z.string().regex(ISO_DATE, 'Enter the issue date.'),
    dueDate: z.string().regex(ISO_DATE, 'Enter a valid due date.').nullable().optional(),
    tax: z
      .number({ invalid_type_error: 'Enter the tax amount.' })
      .min(0, 'Tax cannot be negative.')
      .max(MAX_EXPENSE_AMOUNT, 'Tax is above the app limit.'),
    notes: z.string().max(1000, 'Keep the notes under 1000 characters.').optional(),
    items: z
      .array(
        z.object({
          description: z
            .string()
            .trim()
            .min(1, 'Describe each item.')
            .max(200, 'Keep item descriptions under 200 characters.'),
          quantity: z
            .number({ invalid_type_error: 'Enter a quantity.' })
            .positive('Quantity must be more than zero.')
            .max(10_000, 'Quantity is above the app limit.'),
          unitPrice: z
            .number({ invalid_type_error: 'Enter a price.' })
            .min(0, 'Price cannot be negative.')
            .max(MAX_EXPENSE_AMOUNT, 'Price is above the app limit.'),
        })
      )
      .min(1, 'Add at least one item.'),
  })
  .refine((b) => !b.dueDate || b.dueDate >= b.issueDate, {
    path: ['dueDate'],
    message: 'The due date cannot be before the issue date.',
  });

export type ServiceBillInput = z.infer<typeof serviceBillSchema>;
