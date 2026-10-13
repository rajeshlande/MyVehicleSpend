import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CalendarPage } from './CalendarPage';

const hook = vi.hoisted(() => ({
  items: undefined as unknown,
}));
vi.mock('../reminders/useReminders', () => ({
  useReminders: () => ({ items: hook.items, error: null, reload: vi.fn() }),
}));
vi.mock('../vehicles/VehicleContext', () => ({
  useVehicles: () => ({
    activeVehicle: { id: 'v1', startOdometerKm: 0, registrationNo: 'MH12AB1234' },
    vehicles: [],
  }),
}));

function reminder(id: string, title: string, dueDate?: string) {
  return {
    id,
    vehicleId: 'v1',
    reminderType: 'insurance',
    title,
    dueDate,
    leadDays: 30,
    isDone: false,
    state: { status: 'upcoming' },
  };
}

function renderCalendar() {
  return render(
    <MemoryRouter>
      <CalendarPage initialMonth="2026-10" />
    </MemoryRouter>
  );
}

beforeEach(() => {
  hook.items = [
    reminder('a', 'Insurance renewal', '2026-10-15'),
    reminder('b', 'PUC check', '2026-10-15'),
    reminder('c', 'Service by km'),
  ];
});

describe('Calendar month view (Base design)', () => {
  it('shows the month title and the page heading', () => {
    renderCalendar();
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'October 2026' })).toBeInTheDocument();
  });

  it('puts each dated reminder on its due day', () => {
    renderCalendar();
    const day = screen.getByRole('gridcell', { name: '15/10/2026' });
    expect(within(day).getByText('Insurance renewal')).toBeInTheDocument();
    expect(within(day).getByText('PUC check')).toBeInTheDocument();
  });

  it('lists reminders without a date separately, not on the grid', () => {
    renderCalendar();
    const note = screen.getByRole('region', { name: 'Reminders without a date' });
    expect(within(note).getByText('Service by km')).toBeInTheDocument();
  });

  it('moves to the next and previous month', async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { level: 2, name: 'November 2026' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { level: 2, name: 'September 2026' })).toBeInTheDocument();
  });
});

describe('Calendar views (Base design)', () => {
  it('shows a week list with the reminders on their days', async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Week' }));
    // The calendar opens on 1 Oct, in the week of 27 Sep; 15 Oct is two weeks on.
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    const day = screen.getByRole('group', { name: '15/10/2026' });
    expect(within(day).getByText('Insurance renewal')).toBeInTheDocument();
    expect(within(day).getByText('PUC check')).toBeInTheDocument();
  });

  it('shows a day view for the anchor date', async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(screen.getByRole('heading', { level: 2, name: '01/10/2026' })).toBeInTheDocument();
    expect(screen.getByText('Nothing due')).toBeInTheDocument();
  });

  it('steps the day view to the next date and its reminders', async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Day' }));
    // 1 Oct to 15 Oct is fourteen steps.
    for (let i = 0; i < 14; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Next day' }));
    }
    expect(screen.getByRole('group', { name: '15/10/2026' })).toBeInTheDocument();
    expect(screen.getByText('Insurance renewal')).toBeInTheDocument();
  });

  it('shows the year with a reminder count per month', async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(screen.getByRole('heading', { level: 2, name: '2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'October 2026, 2 reminders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'January 2026, 0 reminders' })).toBeInTheDocument();
  });

  it('opens the month when a month in the year view is chosen', async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    await userEvent.click(screen.getByRole('button', { name: 'November 2026, 0 reminders' }));
    expect(screen.getByRole('heading', { level: 2, name: 'November 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
  });
});
