// T23 UI — Turn on reminders opt-in and in-app notifications (TC-REM-05; FR-REM-04).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Reminder } from '../../data/reminders';

const api = vi.hoisted(() => ({
  listReminders: vi.fn(),
  listFuelLogs: vi.fn(),
  listExpenses: vi.fn(),
  listCategories: vi.fn(),
}));
vi.mock('../../data/reminders', () => ({
  listReminders: api.listReminders,
  markReminderDone: vi.fn(),
  createReminder: vi.fn(),
  updateReminder: vi.fn(),
  deleteReminder: vi.fn(),
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
const overdue: Reminder = {
  id: 'puc',
  vehicleId: VEH,
  reminderType: 'puc',
  title: 'PUC certificate',
  dueDate: '2000-01-01', // long past, so overdue whatever the clock says
  leadDays: 15,
  isDone: false,
};

type NotificationStub = {
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
  shown: { title: string; options?: NotificationOptions }[];
};

/** Stubs the browser Notification API. `answer` is what requestPermission resolves to. */
function stubNotification(
  initial: NotificationPermission,
  answer: NotificationPermission
): NotificationStub {
  const stub: NotificationStub = {
    permission: initial,
    requestPermission: vi.fn(async () => {
      stub.permission = answer;
      return answer;
    }),
    shown: [],
  };
  const Fake = vi.fn(function (this: unknown, title: string, options?: NotificationOptions) {
    stub.shown.push({ title, options });
  });
  Object.defineProperty(Fake, 'permission', { get: () => stub.permission });
  Object.assign(Fake, { requestPermission: stub.requestPermission });
  vi.stubGlobal('Notification', Fake);
  return stub;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vehicleState.value = {
    vehicles: [{ id: VEH }],
    activeVehicle: {
      id: VEH,
      registrationNo: 'MH01AB1234',
      startOdometerKm: 51000,
      fuelType: 'petrol',
    },
  };
  api.listReminders.mockResolvedValue([overdue]);
  api.listFuelLogs.mockResolvedValue([]);
  api.listExpenses.mockResolvedValue([]);
  api.listCategories.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <RemindersPage />
    </MemoryRouter>
  );
}

describe('Turn on reminders — opt-in (FR-REM-04, TC-REM-05)', () => {
  it('does not ask for permission on page load', async () => {
    const stub = stubNotification('default', 'granted');
    renderPage();
    await screen.findByRole('button', { name: 'Turn on reminders' });
    expect(stub.requestPermission).not.toHaveBeenCalled();
  });

  it('asks only after the user taps Turn on reminders, and then shows they are on', async () => {
    const stub = stubNotification('default', 'granted');
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Turn on reminders' }));
    expect(stub.requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Reminders are on.')).toBeInTheDocument();
    expect(localStorage.getItem('reminders.notifications')).toBe('on');
  });

  it('declining does not break the app: the list still shows and a plain message explains', async () => {
    stubNotification('default', 'denied');
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Turn on reminders' }));
    expect(await screen.findByText(/Notifications are blocked/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Overdue' })).toHaveTextContent('PUC certificate');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a browser without notifications shows a message and the list still works', async () => {
    renderPage();
    expect(await screen.findByText(/does not support notifications/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Overdue' })).toHaveTextContent('PUC certificate');
  });
});

describe('In-app notifications while the app is open (FR-REM-04)', () => {
  it('shows a notification for an overdue reminder once a day, not on every visit', async () => {
    const stub = stubNotification('granted', 'granted');
    localStorage.setItem('reminders.notifications', 'on');

    const first = renderPage();
    await waitFor(() => expect(stub.shown).toHaveLength(1));
    expect(stub.shown[0]).toMatchObject({ title: 'PUC certificate', options: { body: 'Overdue' } });
    first.unmount();

    renderPage();
    await screen.findByRole('region', { name: 'Overdue' });
    expect(stub.shown).toHaveLength(1);
  });

  it('shows nothing when the user has turned reminders off', async () => {
    const stub = stubNotification('granted', 'granted');
    localStorage.setItem('reminders.notifications', 'off');
    renderPage();
    await screen.findByRole('region', { name: 'Overdue' });
    expect(stub.shown).toHaveLength(0);
  });
});
