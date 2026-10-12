import { z } from 'zod';

/** Loan form rules (FR-LOAN-01). Pure. */
export const MAX_LOAN_PRINCIPAL = 100_000_000; // ₹10 crore

export const loanInputSchema = z.object({
  vehicleId: z.string().uuid('Choose a vehicle.'),
  lender: z
    .string()
    .trim()
    .min(1, 'Enter the lender name.')
    .max(80, 'Keep the lender name under 80 characters.'),
  accountLast4: z
    .string()
    .regex(/^\d{4}$/, 'Enter the last 4 digits of the loan account.')
    .optional(),
  principal: z
    .number({ invalid_type_error: 'Enter the loan amount.' })
    .positive('Loan amount must be more than zero.')
    .max(MAX_LOAN_PRINCIPAL, 'Loan amount is too large.'),
  annualRatePct: z
    .number({ invalid_type_error: 'Enter the interest rate.' })
    .min(0, 'Interest rate cannot be negative.')
    .max(60, 'Interest rate must be at most 60%.'),
  tenureMonths: z
    .number({ invalid_type_error: 'Enter the tenure in months.' })
    .int('Tenure must be a whole number of months.')
    .min(1, 'Tenure must be at least 1 month.')
    .max(360, 'Tenure must be at most 360 months.'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid start date.'),
  interestMethod: z.enum(['reducing', 'flat']),
  processingFee: z.number().min(0, 'Processing fee cannot be negative.'),
  otherCharges: z.number().min(0, 'Other charges cannot be negative.'),
});

export type LoanInput = z.infer<typeof loanInputSchema>;
