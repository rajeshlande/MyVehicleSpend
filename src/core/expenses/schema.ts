import { z } from 'zod';
import { isValidAmount } from '../money/money';
import { todayIST, isFutureBeyondTomorrow } from '../dates/dates';

export const PAYMENT_MODES = [
  'cash',
  'upi',
  'card',
  'netbanking',
  'fastag',
  'emi',
  'other',
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Expense entry rules (FR-EXP-01, FR-EXP-06, RULE-05). */
export const expenseInputSchema = z
  .object({
    vehicleId: z.string().uuid('Choose a vehicle.'),
    categoryId: z.string().uuid('Choose a category.'),
    expenseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
      .refine(
        (d) => !isFutureBeyondTomorrow(d, todayIST()),
        'The date cannot be more than a day in the future.'
      ),
    amount: z.number({ invalid_type_error: 'Enter an amount in rupees.' }).refine(isValidAmount, {
      message: 'Amount must be more than ₹0 and at most ₹1 crore.',
    }),
    gstAmount: z.number().min(0, 'GST cannot be negative.').default(0),
    paymentMode: z.enum(PAYMENT_MODES, { errorMap: () => ({ message: 'Choose a payment mode.' }) }),
    vendor: optionalText(120),
    odometerKm: z
      .number()
      .int('Odometer must be a whole number.')
      .min(0, 'Odometer cannot be negative.')
      .optional(),
    notes: optionalText(1000),
  })
  .refine((v) => v.gstAmount <= v.amount, {
    message: 'GST cannot be more than the amount.',
    path: ['gstAmount'],
  });

export type ExpenseInput = z.infer<typeof expenseInputSchema>;
