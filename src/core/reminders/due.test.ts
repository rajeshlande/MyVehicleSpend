// T21 — reminder due logic (FR-REM-01, FR-REM-02; TC-REM-01, TC-REM-02, TC-REM-04). Pure.
import { describe, it, expect } from 'vitest';
import { reminderStatus, dueSoonFrom, inDashboardWindow, KM_LEAD } from './due';

const TODAY = '2026-10-12';

describe('dueSoonFrom — due date minus lead days (TC-REM-01)', () => {
  it('insurance due 02/12/2026 with 15 days lead shows from 17/11/2026', () => {
    expect(dueSoonFrom('2026-12-02', 15)).toBe('2026-11-17');
  });
});

describe('reminderStatus — dates (TC-REM-01, TC-REM-02)', () => {
  it('inside the lead window is Due soon (from 17/11/2026 for a 02/12/2026 due date)', () => {
    const r = { dueDate: '2026-12-02', leadDays: 15, isDone: false };
    expect(reminderStatus(r, { today: '2026-11-17' }).status).toBe('due_soon');
    expect(reminderStatus(r, { today: '2026-11-16' }).status).toBe('upcoming');
  });

  it('a PUC due yesterday is Overdue (TC-REM-02)', () => {
    const r = reminderStatus(
      { dueDate: '2026-10-11', leadDays: 15, isDone: false },
      { today: TODAY }
    );
    expect(r.status).toBe('overdue');
  });

  it('due today is not overdue yet, but is due soon', () => {
    expect(
      reminderStatus({ dueDate: TODAY, leadDays: 0, isDone: false }, { today: TODAY }).status
    ).toBe('due_soon');
  });

  it('reports days left for an upcoming date', () => {
    expect(
      reminderStatus({ dueDate: '2026-10-22', leadDays: 15, isDone: false }, { today: TODAY })
        .daysLeft
    ).toBe(10);
  });

  it('a done reminder is Done whatever its dates say', () => {
    expect(
      reminderStatus({ dueDate: '2026-10-01', leadDays: 15, isDone: true }, { today: TODAY }).status
    ).toBe('done');
  });
});

describe('reminderStatus — service by km (TC-REM-04)', () => {
  it('due at 52,000 km with the odometer at 51,800 shows 200 km to go and Due soon', () => {
    const r = reminderStatus(
      { dueOdometerKm: 52000, leadDays: 15, isDone: false },
      { today: TODAY, currentOdometerKm: 51800 }
    );
    expect(r.kmLeft).toBe(200);
    expect(r.status).toBe('due_soon');
  });

  it('is Overdue once the odometer reaches the due reading', () => {
    expect(
      reminderStatus(
        { dueOdometerKm: 52000, leadDays: 15, isDone: false },
        { today: TODAY, currentOdometerKm: 52000 }
      ).status
    ).toBe('overdue');
  });

  it('is Upcoming when more than the km lead remains', () => {
    expect(
      reminderStatus(
        { dueOdometerKm: 60000, leadDays: 15, isDone: false },
        { today: TODAY, currentOdometerKm: 51800 }
      ).status
    ).toBe('upcoming');
    expect(KM_LEAD).toBe(500);
  });

  it('without a current reading, a km-only reminder cannot be evaluated and stays Upcoming', () => {
    expect(
      reminderStatus({ dueOdometerKm: 52000, leadDays: 15, isDone: false }, { today: TODAY }).status
    ).toBe('upcoming');
  });

  it('when both a date and a km are set, the earlier trigger decides', () => {
    const r = reminderStatus(
      { dueDate: '2027-06-01', dueOdometerKm: 52000, leadDays: 15, isDone: false },
      { today: TODAY, currentOdometerKm: 52100 }
    );
    expect(r.status).toBe('overdue');
  });
});

describe('inDashboardWindow — Home lists items due in 30 days, and overdue (FR-REM-02)', () => {
  it('includes overdue and due-within-30-days, excludes later and done', () => {
    expect(inDashboardWindow({ status: 'overdue' })).toBe(true);
    expect(inDashboardWindow({ status: 'due_soon', daysLeft: 3 })).toBe(true);
    expect(inDashboardWindow({ status: 'upcoming', daysLeft: 30 })).toBe(true);
    expect(inDashboardWindow({ status: 'upcoming', daysLeft: 31 })).toBe(false);
    expect(inDashboardWindow({ status: 'done' })).toBe(false);
  });
});
