/** Mark-done rules (FR-REM-03). Pure. */
import { z } from 'zod';
import { todayIST, isFutureBeyondTomorrow } from '../dates/dates';
import { PAYMENT_MODES } from '../expenses/schema';
import type { ReminderType } from './schema';

/**
 * Seed category each reminder type records against (supabase/seed.sql).
 * The user can pick another category in the form. Custom reminders have no default.
 */
const DEFAULTS: Partial<Record<ReminderType, { group: string; name: string }>> = {
  insurance: { group: 'Insurance', name: 'Insurance renewal fee' },
  puc: { group: 'Government & RTO', name: 'PUC certificate' },
  fitness: { group: 'Government & RTO', name: 'Fitness certificate' },
  licence: { group: 'Government & RTO', name: 'Licence fee / renewal' },
  road_tax: { group: 'Government & RTO', name: 'Road tax' },
  service_date: { group: 'Maintenance & Service', name: 'Periodic service' },
  service_km: { group: 'Maintenance & Service', name: 'Periodic service' },
  loan_emi: { group: 'Loan & Finance', name: 'EMI payment' },
};

export function defaultCategoryFor(type: ReminderType): { group: string; name: string } | null {
  return DEFAULTS[type] ?? null;
}

export const markDoneSchema = z
  .object({
    doneOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
      .refine(
        (d) => !isFutureBeyondTomorrow(d, todayIST()),
        'The date cannot be more than a day in the future.'
      ),
    recordExpense: z.boolean(),
    amount: z.number().max(10_000_000, 'Amount is too large.').optional(),
    categoryId: z.string().uuid().optional(),
    paymentMode: z.enum(PAYMENT_MODES).optional(),
    vendor: z.string().trim().max(120, 'Keep the vendor under 120 characters.').optional(),
    notes: z.string().max(1000, 'Keep notes under 1000 characters.').optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.recordExpense) return;
    if (v.amount === undefined || !(v.amount > 0)) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter an amount above zero.' });
    }
    if (!v.categoryId) {
      ctx.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: 'Choose a category for the expense.',
      });
    }
  });

export type MarkDoneInput = z.infer<typeof markDoneSchema>;
