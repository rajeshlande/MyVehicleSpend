import { z } from 'zod';

/** Minimum password length from SRS FR-AUTH-01 / Sysadmin Guide §6.1. */
export const PASSWORD_MIN_LENGTH = 8;

export const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().max(60, 'Name must be 60 characters or fewer.').optional(),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
