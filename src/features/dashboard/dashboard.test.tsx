// T24 UI — Home dashboard (FR-RPT-01, FR-RPT-02; TC-RPT-01, TC-RPT-04).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({
  listExpenses: vi.fn(),
  listFuelLogs: vi.fn(),
  listLoans: vi.fn(),
  listLoanPayments: vi.fn(),
  listReminders: vi.fn(),
}));
vi.mock('../../data/expenses', () => ({
  listExpenses: api.listExpenses,
  listCategories: vi.fn(async () => []),
}));
vi.mock('../../data/fuel', () => ({ listFuelLogs: api.listFuelLogs }));
vi.mock('../../data/loans', () => ({
  listLoans: api.listLoans,
  listLoanPayments: api.listLoanPayments,
}));
vi.mock('../../data/reminders', () => ({ listReminders: api.listReminders }));
// Fixed "today" so the presets are deterministic: 11 Oct 2026.
vi.mock('../../core/dates/dates', async (orig) => ({
  ...(await orig<typeof import('../../core/dates/dates')>()),
  todayIST: () => '2026-10-11',
}));

import { Dashboard } from './Dashboard';

const VEHICLE = {
  id: '11111111-1111-4111-8111-111111111111',
  registrationNo: 'MH01AB1234',
  startOdometerKm: 48000,
  fuelType: 'petrol',
};

const expense = (
  id: string,
  expenseDate: string,
  amount: number,
  categoryGroup = 'Fuel',
  odometerKm?: number
) => ({
  id,
  vehicleId: VEHICLE.id,
  categoryId: 'c',
  categoryGroup,
  categoryName: 'x',
  expenseDate,
  amount,
  gstAmount: 0,
  paymentMode: 'upi',
  receiptPaths: [],
  source: 'manual',
  odometerKm,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.listExpenses.mockResolvedValue([]);
  api.listFuelLogs.mockResolvedValue([]);
  api.listLoans.mockResolvedValue([]);
  api.listLoanPayments.mockResolvedValue([]);
  api.listReminders.mockResolvedValue([]);
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard vehicle={VEHICLE} />
    </MemoryRouter>
  );
}

describe('Dashboard totals (TC-RPT-01)', () => {
  it('shows this month total to the paisa, excluding other months', async () => {
    api.listExpenses.mockResolvedValue([
      expense('a', '2026-10-01', 100.1),
      expense('b', '2026-10-09', 200.2),
      expense('c', '2026-09-30', 500), // last month
      expense('d', '2026-11-01', 500), // next month
    ]);
    renderDashboard();
    expect(await screen.findByTestId('dash-total')).toHaveTextContent('₹300.30');
  });

  it('switching to last month shows last month only', async () => {
    api.listExpenses.mockResolvedValue([
      expense('a', '2026-10-01', 100),
      expense('c', '2026-09-30', 500),
    ]);
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByTestId('dash-total');
    await user.selectOptions(screen.getByLabelText('Period'), 'Last month');
    expect(screen.getByTestId('dash-total')).toHaveTextContent('₹500.00');
  });

  it('shows cost per km from the odometer span (TC-FUEL-05 example)', async () => {
    api.listExpenses.mockResolvedValue([expense('a', '2026-10-02', 6000, 'Fuel', 48000)]);
    api.listFuelLogs.mockResolvedValue([{ filledOn: '2026-10-20', odometerKm: 48600 }]);
    renderDashboard();
    const card = (await screen.findByText('Cost per km')).closest('div') as HTMLElement;
    expect(within(card).getByText('₹10.00/km')).toBeInTheDocument();
  });

  it('explains cost per km when there are not enough readings, without NaN', async () => {
    api.listExpenses.mockResolvedValue([expense('a', '2026-10-02', 6000)]);
    renderDashboard();
    expect(
      await screen.findByText('Cost per km needs two odometer readings in this period.')
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });
});

describe('Custom period (FR-RPT-02)', () => {
  it('a start date after the end date shows a message and no totals', async () => {
    api.listExpenses.mockResolvedValue([expense('a', '2026-10-02', 100)]);
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByTestId('dash-total');
    await user.selectOptions(screen.getByLabelText('Period'), 'Custom');
    await user.clear(screen.getByLabelText('From'));
    await user.type(screen.getByLabelText('From'), '2026-12-01');
    await user.clear(screen.getByLabelText('To'));
    await user.type(screen.getByLabelText('To'), '2026-01-31');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The start date must be on or before the end date.'
    );
    expect(screen.queryByTestId('dash-total')).not.toBeInTheDocument();
  });
});

describe('Empty state (TC-RPT-04)', () => {
  it('a new vehicle sees onboarding links and no charts or NaN', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: 'No expenses yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add an expense' })).toHaveAttribute(
      'href',
      '/expenses'
    );
    expect(screen.getByRole('link', { name: 'Add a fuel fill' })).toHaveAttribute('href', '/fuel');
    expect(screen.queryByRole('img', { name: 'Spend by category' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });
});

describe('Loan outstanding (FR-RPT-01)', () => {
  it('shows outstanding principal after paid instalments, from active loans only', async () => {
    api.listLoans.mockResolvedValue([
      { id: 'l1', status: 'active', principal: 100000 },
      { id: 'l2', status: 'closed', principal: 50000 },
    ]);
    api.listLoanPayments.mockResolvedValue([
      { status: 'paid', principalComponent: 5000, interestComponent: 900 },
      { status: 'scheduled', principalComponent: 5100, interestComponent: 800 },
    ]);
    renderDashboard();
    const card = (await screen.findByText('Loan outstanding')).closest('div') as HTMLElement;
    expect(await within(card).findByText('₹95,000.00')).toBeInTheDocument();
    expect(within(card).getByText(/across 1 active loan$/)).toBeInTheDocument();
    expect(api.listLoanPayments).toHaveBeenCalledTimes(1);
  });

  it('says so when there are no active loans', async () => {
    renderDashboard();
    expect(await screen.findByText('No active loans.')).toBeInTheDocument();
  });
});
