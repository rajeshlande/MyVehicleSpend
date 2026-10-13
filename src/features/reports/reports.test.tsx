// T25 UI — Reports page: FY filter, monthly category table, CSV exports (FR-RPT-03..05; TC-RPT-02, TC-RPT-03).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({
  listExpenses: vi.fn(),
  listFuelLogs: vi.fn(),
  listLoans: vi.fn(),
  listLoanPayments: vi.fn(),
  downloadText: vi.fn(),
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
vi.mock('./download', () => ({ downloadText: api.downloadText }));
vi.mock('../../core/dates/dates', async (orig) => ({
  ...(await orig<typeof import('../../core/dates/dates')>()),
  todayIST: () => '2026-10-11',
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

import { ReportsPage } from './ReportsPage';

const VEH = '11111111-1111-4111-8111-111111111111';

const expense = (
  id: string,
  expenseDate: string,
  amount: number,
  categoryGroup: string,
  extra = {}
) => ({
  id,
  vehicleId: VEH,
  categoryId: 'c',
  categoryGroup,
  categoryName: categoryGroup,
  expenseDate,
  amount,
  gstAmount: 0,
  paymentMode: 'upi',
  receiptPaths: [],
  source: 'manual',
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vehicleState.value = {
    vehicles: [{ id: VEH }],
    activeVehicle: {
      id: VEH,
      registrationNo: 'MH01AB1234',
      startOdometerKm: 48000,
      fuelType: 'petrol',
    },
  };
  api.listExpenses.mockResolvedValue([]);
  api.listFuelLogs.mockResolvedValue([]);
  api.listLoans.mockResolvedValue([]);
  api.listLoanPayments.mockResolvedValue([]);
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>
  );
}

describe('Reports period and monthly table (FR-RPT-03, FR-RPT-05, TC-RPT-02)', () => {
  it('defaults to This FY, excludes 1 March data, and shows category columns', async () => {
    api.listExpenses.mockResolvedValue([
      expense('a', '2026-03-01', 500, 'Fuel'), // before the FY, excluded
      expense('b', '2026-04-02', 100, 'Fuel'),
      expense('c', '2026-05-10', 50, 'Insurance'),
    ]);
    renderPage();
    expect(await screen.findByTestId('report-total')).toHaveTextContent('₹150.00');
    const table = screen.getByRole('table', { name: 'Monthly category table' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual(['Month', 'Fuel', 'Insurance', 'Total']);
    expect(within(table).getByRole('rowheader', { name: 'Apr 26' })).toBeInTheDocument();
  });

  it('a custom range with the start after the end shows a message and no table', async () => {
    api.listExpenses.mockResolvedValue([expense('a', '2026-04-02', 100, 'Fuel')]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('report-total');
    await user.selectOptions(screen.getByLabelText('Period'), 'Custom');
    await user.clear(screen.getByLabelText('From'));
    await user.type(screen.getByLabelText('From'), '2026-12-01');
    await user.clear(screen.getByLabelText('To'));
    await user.type(screen.getByLabelText('To'), '2026-01-31');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The start date must be on or before the end date.'
    );
    expect(screen.queryByRole('table', { name: 'Monthly category table' })).not.toBeInTheDocument();
  });

  it('an empty period says so, with no NaN', async () => {
    api.listExpenses.mockResolvedValue([expense('a', '2025-01-02', 100, 'Fuel')]);
    renderPage();
    expect(await screen.findByText('No expenses in this period.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });
});

describe('CSV exports (FR-RPT-04, TC-RPT-03)', () => {
  it('expenses export is a BOM-prefixed CSV named for the vehicle and period, with only in-period rows', async () => {
    api.listExpenses.mockResolvedValue([
      expense('a', '2026-03-01', 500, 'Fuel'),
      expense('b', '2026-04-02', 1250.5, 'Fuel', { vendor: 'शर्मा पेट्रोल' }),
    ]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Export expenses (1)' }));
    expect(api.downloadText).toHaveBeenCalledTimes(1);
    const [filename, content] = api.downloadText.mock.calls[0] as [string, string];
    expect(filename).toBe('expenses_MH01AB1234_2026-04-01_2027-03-31.csv');
    expect(content.startsWith('\uFEFF')).toBe(true);
    expect(content).toContain('शर्मा पेट्रोल');
    expect(content).toContain('1250.50');
    expect(content).not.toContain('2026-03-01');
  });

  it('fuel export is disabled when there are no fills in the period', async () => {
    renderPage();
    const btn = await screen.findByRole('button', { name: 'Export fuel log (0)' });
    expect(btn).toBeDisabled();
  });

  it('fuel export downloads when there are fills in the period', async () => {
    api.listFuelLogs.mockResolvedValue([
      {
        id: 'f',
        vehicleId: VEH,
        filledOn: '2026-07-01',
        odometerKm: 48600,
        litres: 30,
        pricePerUnit: 105.4,
        totalAmount: 3162,
        isFullTank: true,
      },
    ]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Export fuel log (1)' }));
    const [filename, content] = api.downloadText.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^fuel_MH01AB1234_/);
    expect(content).toContain('2026-07-01,48600,30.000');
  });

  it('loan schedule export needs a loan chosen first, then downloads that loan', async () => {
    api.listLoans.mockResolvedValue([{ id: 'l1', lender: 'HDFC Bank', status: 'active' }]);
    api.listLoanPayments.mockResolvedValue([
      {
        id: 'p1',
        installmentNo: 1,
        dueDate: '2026-01-05',
        scheduledEmi: 8500,
        principalComponent: 6000,
        interestComponent: 2500,
        openingBalance: 100000,
        closingBalance: 94000,
        status: 'paid',
        paidOn: '2026-01-06',
        paidAmount: 8600,
        lateFee: 100,
        bounceCharge: 0,
      },
    ]);
    const user = userEvent.setup();
    renderPage();
    const exportBtn = await screen.findByRole('button', { name: 'Export loan schedule' });
    expect(exportBtn).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Loan for schedule'), 'l1');
    await user.click(exportBtn);
    expect(api.listLoanPayments).toHaveBeenCalledWith('l1');
    const [filename, content] = api.downloadText.mock.calls[0] as [string, string];
    expect(filename).toBe('loan-schedule_hdfc-bank.csv');
    expect(content.startsWith('\uFEFF')).toBe(true);
    expect(content).toContain('1,2026-01-05,8500.00');
  });
});

describe('Analytics page (Base design)', () => {
  it('is titled Analytics, matching the sidebar', async () => {
    api.listExpenses.mockResolvedValue([expense('a', '2026-04-02', 100, 'Fuel')]);
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
  });

  it('shows the period total as a stat card with a tinted icon tile', async () => {
    api.listExpenses.mockResolvedValue([expense('a', '2026-04-02', 100, 'Fuel')]);
    renderPage();
    const summary = await screen.findByRole('region', { name: 'Period summary' });
    const tile = summary.querySelector('.stat-icon');
    expect(tile).not.toBeNull();
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(within(summary).getByTestId('report-total')).toHaveTextContent('₹100.00');
  });
});
