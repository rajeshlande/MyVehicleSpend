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
