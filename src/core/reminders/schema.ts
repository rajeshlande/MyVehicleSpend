import { z } from 'zod';

/** Reminder types (SRS FR-REM-01; schema check on reminders.reminder_type). */
export const REMINDER_TYPES = [
  'insurance',
  'puc',
  'fitness',
  'licence',
  'road_tax',
  'service_date',
  'service_km',
  'loan_emi',
  'custom',
] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REMINDER_TYPE_LABEL: Record<ReminderType, string> = {
  insurance: 'Insurance',
  puc: 'PUC certificate',
  fitness: 'Fitness certificate',
  licence: 'Licence renewal',
  road_tax: 'Road tax',
  service_date: 'Service (by date)',
  service_km: 'Service (by km)',
  loan_emi: 'Loan EMI',
  custom: 'Custom',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const reminderInputSchema = z
  .object({
    vehicleId: z.string().uuid('Choose a vehicle.'),
    reminderType: z.enum(REMINDER_TYPES, {
      errorMap: () => ({ message: 'Choose a reminder type.' }),
    }),
    title: z
      .string()
      .trim()
      .min(1, 'Enter a title.')
      .max(120, 'Keep the title under 120 characters.'),
    dueDate: z.string().regex(DATE, 'Use a valid date.').optional(),
    dueOdometerKm: z
      .number({ invalid_type_error: 'Enter the odometer reading as a number.' })
      .int('Odometer must be a whole number.')
      .min(0, 'Odometer cannot be negative.')
      .optional(),
    leadDays: z
      .number({ invalid_type_error: 'Enter the lead time in days.' })
      .int('Lead time must be a whole number of days.')
      .min(0, 'Lead time cannot be negative.')
      .max(90, 'Lead time must be at most 90 days.'),
    insurer: z.string().trim().max(80, 'Keep the insurer name under 80 characters.').optional(),
    policyNo: z.string().trim().max(40, 'Keep the policy number under 40 characters.').optional(),
    idvAmount: z.number().min(0, 'IDV cannot be negative.').optional(),
    premiumAmount: z.number().min(0, 'Premium cannot be negative.').optional(),
    notes: z.string().max(1000, 'Keep notes under 1000 characters.').optional(),
  })
  .superRefine((r, ctx) => {
    // Custom reminders may use either trigger; other types ask for their own field below.
    if (r.reminderType === 'custom' && r.dueDate === undefined && r.dueOdometerKm === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Set a due date or a due odometer reading.',
      });
    }
    if (r.reminderType === 'service_km' && r.dueOdometerKm === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueOdometerKm'],
        message: 'Enter the odometer reading the service is due at.',
      });
    }
    if (r.reminderType === 'service_date' && r.dueDate === undefined) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Enter the service due date.' });
    }
    if (r.reminderType !== 'custom' && r.reminderType !== 'service_km' && r.dueDate === undefined) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Enter the due date.' });
    }
  });

export type ReminderInput = z.infer<typeof reminderInputSchema>;
