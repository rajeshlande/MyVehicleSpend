// T22 UI — mark done, optionally recording the expense (TC-REM-03; FR-REM-03).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Reminder } from '../../data/reminders';
import type { Category } from '../../data/expenses';

const api = vi.hoisted(() => ({
  listReminders: vi.fn(),
  markReminderDone: vi.fn(),
  listFuelLogs: vi.fn(),
  listExpenses: vi.fn(),
  listCategories: vi.fn(),
  createReminder: vi.fn(),
  updateReminder: vi.fn(),
  deleteReminder: vi.fn(),
}));
vi.mock('../../data/reminders', () => ({
  listReminders: api.listReminders,
  markReminderDone: api.markReminderDone,
  createReminder: api.createReminder,
  updateReminder: api.updateReminder,
  deleteReminder: api.deleteReminder,
}));
vi.mock('../../data/fuel', () => ({ listFuelLogs: api.listFuelLogs }));
vi.mock('../../data/expenses', () => ({
  listExpenses: api.listExpenses,
  listCategories: api.listCategories,
}));

const vehicleState = vi.hoisted(() => ({
  value: {
    vehicles: [] as unknown[],
    activeVehicle: null as null | {
      id: string;
      registrationNo: string;
      startOdometerKm: number;
      fuelType: string;
    },
  },
}));
vi.mock('../vehicles/VehicleContext', () => ({ useVehicles: () => vehicleState.value }));

import { RemindersPage } from './RemindersPage';

const VEH = '11111111-1111-4111-8111-111111111111';
const PUC_CAT = '66666666-6666-4666-8666-666666666666';

const categories: Category[] = [
  { id: PUC_CAT, groupName: 'Government & RTO', name: 'PUC certificate' },
  { id: '77777777-7777-4777-8777-777777777777', groupName: 'Government & RTO', name: 'Road tax' },
];

const puc: Reminder = {
  id: 'puc-1',
  vehicleId: VEH,
  reminderType: 'puc',
  title: 'PUC certificate',
  dueDate: '2026-10-01',
  leadDays: 15,
  isDone: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vehicleState.value = {
    vehicles: [{ id: VEH }],
    activeVehicle: {
      id: VEH,
      registrationNo: 'MH01AB1234',
      startOdometerKm: 51000,
      fuelType: 'petrol',
    },
  };
  api.listReminders.mockResolvedValue([puc]);
  api.listFuelLogs.mockResolvedValue([]);
  api.listExpenses.mockResolvedValue([]);
  api.listCategories.mockResolvedValue(categories);
  api.markReminderDone.mockResolvedValue({ ...puc, isDone: true, doneOn: '2026-10-12' });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <RemindersPage />
    </MemoryRouter>
  );
}

describe('Mark done — TC-REM-03', () => {
  it('records ₹100 under PUC certificate, dated today, and marks the reminder done', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Mark done PUC certificate' }));
    await user.click(screen.getByLabelText('Record as expense'));
    await user.type(screen.getByLabelText('Amount (₹)'), '100');
    // The category is pre-selected from the reminder type.
    expect(screen.getByLabelText('Expense category')).toHaveValue(PUC_CAT);
    await user.click(screen.getByRole('button', { name: 'Mark done' }));

    await waitFor(() => expect(api.markReminderDone).toHaveBeenCalledTimes(1));
    const [id, input] = api.markReminderDone.mock.calls[0]!;
    expect(id).toBe('puc-1');
    expect(input).toMatchObject({
      recordExpense: true,
      amount: 100,
      categoryId: PUC_CAT,
      paymentMode: 'upi',
    });
    expect(input.doneOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByRole('status')).toHaveTextContent('“PUC certificate” marked done.');
  });

  it('marks done without an expense when the box is not ticked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Mark done PUC certificate' }));
    expect(screen.queryByLabelText('Amount (₹)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark done' }));
    await waitFor(() => expect(api.markReminderDone).toHaveBeenCalled());
    expect(api.markReminderDone.mock.calls[0]![1]).toMatchObject({ recordExpense: false });
  });

  it('does not save when the expense has no amount', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Mark done PUC certificate' }));
    await user.click(screen.getByLabelText('Record as expense'));
    await user.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(await screen.findByText('Enter an amount above zero.')).toBeInTheDocument();
    expect(api.markReminderDone).not.toHaveBeenCalled();
  });

  it('a done reminder no longer offers Mark done', async () => {
    api.listReminders.mockResolvedValue([{ ...puc, isDone: true, doneOn: '2026-10-05' }]);
    renderPage();
    const group = await screen.findByRole('region', { name: 'Done' });
    expect(within(group).queryByRole('button', { name: /Mark done/ })).not.toBeInTheDocument();
  });
});
