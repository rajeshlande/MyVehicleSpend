// T21 UI — reminders list, Overdue badge, service by km, insurance fields, Home panel (TC-REM-01, TC-REM-02, TC-REM-04; FR-REM-01, 02, 05).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Reminder } from '../../data/reminders';

const api = vi.hoisted(() => ({
  listReminders: vi.fn(),
  createReminder: vi.fn(),
  updateReminder: vi.fn(),
  deleteReminder: vi.fn(),
  listFuelLogs: vi.fn(),
  listExpenses: vi.fn(),
}));
vi.mock('../../data/reminders', () => ({
  listReminders: api.listReminders,
  createReminder: api.createReminder,
  updateReminder: api.updateReminder,
  deleteReminder: api.deleteReminder,
}));
vi.mock('../../data/fuel', () => ({ listFuelLogs: api.listFuelLogs }));
vi.mock('../../data/expenses', () => ({ listExpenses: api.listExpenses }));

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
import { HomePage } from '../placeholders/Screens';

const VEH = '11111111-1111-4111-8111-111111111111';

// Dates are relative to the real clock, so the tests stay valid on any day.
function daysFromToday(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

function rem(over: Partial<Reminder>): Reminder {
  return {
    id: 'r',
    vehicleId: VEH,
    reminderType: 'custom',
    title: 'Reminder',
    leadDays: 15,
    isDone: false,
    ...over,
  };
}

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
  api.listFuelLogs.mockResolvedValue([]);
  api.listExpenses.mockResolvedValue([{ odometerKm: 51800 }]);
});

function renderPage(ui: ReactElement = <RemindersPage />) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RemindersPage — due logic on screen (TC-REM-02, TC-REM-04)', () => {
  it('a PUC due yesterday shows an Overdue badge (TC-REM-02)', async () => {
    api.listReminders.mockResolvedValue([
      rem({ id: 'p', reminderType: 'puc', title: 'PUC certificate', dueDate: daysFromToday(-1) }),
    ]);
    renderPage();
    const row = await screen.findByRole('listitem', { name: /PUC certificate/ });
    expect(within(row).getByText('Overdue')).toBeInTheDocument();
  });

  it('service due at 52,000 km with 51,800 on the odometer shows 200 km to service (TC-REM-04)', async () => {
    api.listReminders.mockResolvedValue([
      rem({ id: 's', reminderType: 'service_km', title: 'Service', dueOdometerKm: 52000 }),
    ]);
    renderPage();
    const row = await screen.findByRole('listitem', { name: /Service/ });
    expect(row).toHaveTextContent('200 km to service');
    expect(within(row).getByText('Due soon')).toBeInTheDocument();
  });

  it('an insurance reminder due in 10 days is Due soon and shows insurer and policy (TC-REM-01, FR-REM-05)', async () => {
    api.listReminders.mockResolvedValue([
      rem({
        id: 'i',
        reminderType: 'insurance',
        title: 'Car insurance',
        dueDate: daysFromToday(10),
        insurer: 'ICICI Lombard',
        policyNo: 'OG-26-1234',
        idvAmount: 520000,
      }),
    ]);
    renderPage();
    const row = await screen.findByRole('listitem', { name: /Car insurance/ });
    expect(within(row).getByText('Due soon')).toBeInTheDocument();
    expect(row).toHaveTextContent('ICICI Lombard');
    expect(row).toHaveTextContent('OG-26-1234');
  });
});

describe('RemindersPage — add form (FR-REM-01, FR-REM-05)', () => {
  it('saves an insurance reminder with its policy fields', async () => {
    api.listReminders.mockResolvedValue([]);
    api.createReminder.mockImplementation(async (input) => rem({ id: 'new', ...input }));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add reminder' }));
    await user.selectOptions(screen.getByLabelText('Reminder type'), 'insurance');
    await user.type(screen.getByLabelText('Title'), 'Car insurance');
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: daysFromToday(30) } });
    await user.type(screen.getByLabelText('Insurer'), 'ICICI Lombard');
    await user.type(screen.getByLabelText('Policy number'), 'OG-26-1234');
    await user.type(screen.getByLabelText('IDV (₹)'), '520000');
    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    await waitFor(() => expect(api.createReminder).toHaveBeenCalledTimes(1));
    expect(api.createReminder.mock.calls[0]![0]).toMatchObject({
      vehicleId: VEH,
      reminderType: 'insurance',
      title: 'Car insurance',
      leadDays: 15,
      insurer: 'ICICI Lombard',
      policyNo: 'OG-26-1234',
      idvAmount: 520000,
    });
  });

  it('an insurance reminder without an expiry date is not saved', async () => {
    api.listReminders.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add reminder' }));
    await user.selectOptions(screen.getByLabelText('Reminder type'), 'insurance');
    await user.type(screen.getByLabelText('Title'), 'Car insurance');
    await user.click(screen.getByRole('button', { name: 'Save reminder' }));
    expect(await screen.findByText('Enter the due date.')).toBeInTheDocument();
    expect(api.createReminder).not.toHaveBeenCalled();
  });
});

describe('Home — reminders due in 30 days and overdue (FR-REM-02)', () => {
  it('lists an overdue PUC on Home with the Overdue badge', async () => {
    api.listReminders.mockResolvedValue([
      rem({ id: 'p', reminderType: 'puc', title: 'PUC certificate', dueDate: daysFromToday(-1) }),
      rem({ id: 'far', title: 'Far away', dueDate: daysFromToday(200) }),
    ]);
    renderPage(<HomePage />);
    const panel = await screen.findByRole('region', { name: 'Reminders' });
    expect(within(panel).getByText('PUC certificate')).toBeInTheDocument();
    expect(within(panel).getByText('Overdue')).toBeInTheDocument();
    expect(within(panel).queryByText('Far away')).not.toBeInTheDocument();
  });
});
