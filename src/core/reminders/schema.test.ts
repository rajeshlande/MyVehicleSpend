// T21 — reminder input rules (FR-REM-01, FR-REM-05).
import { describe, it, expect } from 'vitest';
import { reminderInputSchema } from './schema';

const VEH = '11111111-1111-4111-8111-111111111111';
const insurance = {
  vehicleId: VEH,
  reminderType: 'insurance' as const,
  title: 'Car insurance',
  dueDate: '2026-12-02',
  leadDays: 15,
  insurer: 'ICICI Lombard',
  policyNo: 'OG-26-1234',
  idvAmount: 520000,
  premiumAmount: 18000,
};

describe('reminderInputSchema', () => {
  it('accepts an insurance reminder with its policy fields (TC-REM-01)', () => {
    expect(reminderInputSchema.safeParse(insurance).success).toBe(true);
  });

  it('insurance needs an expiry date (due date)', () => {
    expect(reminderInputSchema.safeParse({ ...insurance, dueDate: undefined }).success).toBe(false);
  });

  it('service by km needs a due odometer reading and accepts no date alone', () => {
    const ok = {
      vehicleId: VEH,
      reminderType: 'service_km',
      title: 'Service',
      dueOdometerKm: 52000,
      leadDays: 15,
    };
    expect(reminderInputSchema.safeParse(ok).success).toBe(true);
    expect(
      reminderInputSchema.safeParse({ ...ok, dueOdometerKm: undefined, dueDate: '2026-12-01' })
        .success
    ).toBe(false);
  });

  it('a custom reminder needs a date or a km reading', () => {
    const base = { vehicleId: VEH, reminderType: 'custom', title: 'Wash', leadDays: 15 };
    expect(reminderInputSchema.safeParse(base).success).toBe(false);
    expect(reminderInputSchema.safeParse({ ...base, dueDate: '2026-12-01' }).success).toBe(true);
  });

  it('lead days must be between 0 and 90', () => {
    expect(reminderInputSchema.safeParse({ ...insurance, leadDays: 91 }).success).toBe(false);
    expect(reminderInputSchema.safeParse({ ...insurance, leadDays: -1 }).success).toBe(false);
  });

  it('title is required and at most 120 characters', () => {
    expect(reminderInputSchema.safeParse({ ...insurance, title: '  ' }).success).toBe(false);
    expect(reminderInputSchema.safeParse({ ...insurance, title: 'x'.repeat(121) }).success).toBe(
      false
    );
  });

  it('rejects negative money fields', () => {
    expect(reminderInputSchema.safeParse({ ...insurance, premiumAmount: -1 }).success).toBe(false);
  });
});
