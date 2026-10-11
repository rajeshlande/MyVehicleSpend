// T12 UI — filters, search, duplicate, quick add (TC-EXP-05, TC-EXP-06, TC-EXP-07, TC-EXP-10).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Category, Expense } from '../../data/expenses';

const api = vi.hoisted(() => ({
  listCategories: vi.fn(),
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}));
vi.mock('../../data/expenses', async (orig) => ({
  ...(await orig<typeof import('../../data/expenses')>()),
  ...api,
}));

const vehicleState = vi.hoisted(() => ({
  value: {
    vehicles: [] as unknown[],
    activeVehicle: null as null | { id: string; registrationNo: string; startOdometerKm: number },
  },
}));
vi.mock('../vehicles/VehicleContext', () => ({ useVehicles: () => vehicleState.value }));

import { ExpensesPage } from './ExpensesPage';
import { QuickAddPage } from './QuickAddPage';

const VEH = '11111111-1111-4111-8111-111111111111';
const PETROL = '22222222-2222-4222-8222-222222222222';
const SERVICE = '33333333-3333-4333-8333-333333333333';

const categories: Category[] = [
  { id: PETROL, groupName: 'Fuel & Energy', name: 'Petrol' },
  { id: SERVICE, groupName: 'Maintenance', name: 'Periodic service' },
];

function row(over: Partial<Expense>): Expense {
  return {
    id: 'x',
    vehicleId: VEH,
    categoryId: PETROL,
    categoryGroup: 'Fuel & Energy',
    categoryName: 'Petrol',
    expenseDate: '2026-10-01',
    amount: 3000,
    gstAmount: 0,
    paymentMode: 'upi',
    receiptPaths: [],
    source: 'manual',
    ...over,
  };
}

const rows: Expense[] = [
  row({ id: 'p1', vendor: 'HP Pump', amount: 3000, expenseDate: '2026-10-01' }),
  row({
    id: 's1',
    categoryId: SERVICE,
    categoryGroup: 'Maintenance',
    categoryName: 'Periodic service',
    vendor: 'Sharma Motors',
    paymentMode: 'card',
    amount: 8500,
    expenseDate: '2026-09-15',
    notes: 'Engine oil',
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vehicleState.value = {
    vehicles: [{ id: VEH }],
    activeVehicle: { id: VEH, registrationNo: 'MH12AB1234', startOdometerKm: 40000 },
  };
  api.listCategories.mockResolvedValue(categories);
  api.listExpenses.mockResolvedValue(rows);
  api.createExpense.mockImplementation(async (input) =>
    row({ id: 'new', ...input, categoryName: 'x' })
  );
  api.updateExpense.mockResolvedValue(rows[0]);
});

function items() {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

describe('Filters (FR-EXP-03, TC-EXP-05)', () => {
  it('filters by category and clears back to the full list', async () => {
    const user = userEvent.setup();
    render(<ExpensesPage />);
    await screen.findByRole('button', { name: /Edit Petrol/ });
    await user.selectOptions(screen.getByLabelText('Filter category'), 'group:Maintenance');
    expect(items()).toHaveLength(1);
    expect(screen.getByText(/1 of 2 shown/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(items()).toHaveLength(2);
  });

  it('filters by payment mode and amount range', async () => {
    const user = userEvent.setup();
    render(<ExpensesPage />);
    await screen.findByRole('button', { name: /Edit Petrol/ });
    await user.selectOptions(screen.getByLabelText('Filter payment mode'), 'card');
    expect(items()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.type(screen.getByLabelText('Min amount (₹)'), '5,000');
    expect(items()).toHaveLength(1);
    expect(screen.getByText('Periodic service', { selector: 'strong' })).toBeInTheDocument();
  });

  it('filters by date range and updates the total', async () => {
    const user = userEvent.setup();
    render(<ExpensesPage />);
    await screen.findByRole('button', { name: /Edit Petrol/ });
    await user.type(screen.getByLabelText('From date'), '2026-10-01');
    expect(items()).toHaveLength(1);
    expect(screen.getByText(/Total shown: ₹3,000\.00/)).toBeInTheDocument();
  });
});

describe('Search (FR-EXP-04, TC-EXP-06)', () => {
  it('finds a vendor case-insensitively', async () => {
    const user = userEvent.setup();
    render(<ExpensesPage />);
    await screen.findByRole('button', { name: /Edit Petrol/ });
    await user.type(screen.getByLabelText('Search vendor or notes'), 'sharma');
    expect(items()).toHaveLength(1);
    expect(screen.getByText('Sharma Motors', { exact: false })).toBeInTheDocument();
  });

  it('shows a clear message when nothing matches', async () => {
    const user = userEvent.setup();
    render(<ExpensesPage />);
    await screen.findByRole('button', { name: /Edit Petrol/ });
    await user.type(screen.getByLabelText('Search vendor or notes'), 'zzz');
    expect(screen.getByText('No expenses match these filters.')).toBeInTheDocument();
  });
});

describe('Duplicate (FR-EXP-05, TC-EXP-07)', () => {
  it('pre-fills the form except the date (today) and saves a new expense', async () => {
    const user = userEvent.setup();
    render(<ExpensesPage />);
    await user.click(await screen.findByRole('button', { name: /Duplicate Periodic service/ }));

    expect(screen.getByLabelText('Category')).toHaveValue(SERVICE);
    expect(screen.getByLabelText('Amount (₹)')).toHaveValue('8500');
    expect(screen.getByLabelText('Payment mode')).toHaveValue('card');
    expect(screen.getByLabelText('Date')).toHaveValue(
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    );

    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(1));
    expect(api.createExpense.mock.lastCall?.[0]).toMatchObject({
      categoryId: SERVICE,
      amount: 8500,
    });
    expect(api.updateExpense).not.toHaveBeenCalled();
  });
});

describe('Quick add (FR-EXP-09, TC-EXP-10)', () => {
  it('saves category + amount in three steps with date today and UPI', async () => {
    const user = userEvent.setup();
    render(<QuickAddPage />);
    await user.selectOptions(await screen.findByLabelText('Category'), PETROL);
    await user.type(screen.getByLabelText('Amount (₹)'), '3000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(1));
    expect(api.createExpense.mock.lastCall?.[0]).toMatchObject({
      vehicleId: VEH,
      categoryId: PETROL,
      amount: 3000,
      paymentMode: 'upi',
    });
    expect(await screen.findByText(/Saved ₹3,000\.00/)).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (₹)')).toHaveValue('');
  });

  it('asks for a category and amount before saving', async () => {
    const user = userEvent.setup();
    render(<QuickAddPage />);
    await screen.findByLabelText('Category');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose a category.')).toBeInTheDocument();
    expect(api.createExpense).not.toHaveBeenCalled();
  });
});
