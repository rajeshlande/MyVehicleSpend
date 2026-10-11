import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
import { DataError } from '../../data/errors';

const VEH = '11111111-1111-4111-8111-111111111111';
const CAT_PETROL = '22222222-2222-4222-8222-222222222222';
const CAT_SERVICE = '33333333-3333-4333-8333-333333333333';

const categories: Category[] = [
  { id: CAT_PETROL, groupName: 'Fuel & Energy', name: 'Petrol' },
  { id: CAT_SERVICE, groupName: 'Maintenance', name: 'Periodic service' },
];

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    vehicleId: VEH,
    categoryId: CAT_PETROL,
    categoryGroup: 'Fuel & Energy',
    categoryName: 'Petrol',
    expenseDate: '2026-10-01',
    amount: 4850,
    gstAmount: 0,
    paymentMode: 'upi',
    vendor: 'HP Pump',
    odometerKm: 48000,
    receiptPaths: [],
    source: 'manual',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vehicleState.value = {
    vehicles: [{ id: VEH }],
    activeVehicle: { id: VEH, registrationNo: 'MH12AB1234', startOdometerKm: 40000 },
  };
  api.listCategories.mockResolvedValue(categories);
  api.listExpenses.mockResolvedValue([expense()]);
  api.createExpense.mockImplementation(async (input) => ({
    ...expense({ id: 'new' }),
    ...input,
    categoryName: 'Periodic service',
  }));
  api.updateExpense.mockImplementation(async (_id, input) => ({
    ...expense(),
    ...input,
    categoryName: 'Petrol',
  }));
  api.deleteExpense.mockResolvedValue(undefined);
});

async function openNewForm() {
  const user = userEvent.setup();
  render(<ExpensesPage />);
  await screen.findByText('Petrol');
  await user.click(screen.getByRole('button', { name: 'Add expense' }));
  return user;
}

describe('Add expense (FR-EXP-01, TC-EXP-01)', () => {
  it('defaults the payment mode to UPI for a new expense', async () => {
    await openNewForm();
    expect(screen.getByLabelText('Payment mode')).toHaveValue('upi');
  });

  it('saves a full entry with normalised values', async () => {
    const user = await openNewForm();
    await user.selectOptions(screen.getByLabelText('Category'), CAT_SERVICE);
    await user.type(screen.getByLabelText('Amount (₹)'), '4,850.50');
    await user.type(screen.getByLabelText('GST included (₹, optional)'), '740');
    await user.selectOptions(screen.getByLabelText('Payment mode'), 'upi');
    await user.type(screen.getByLabelText('Vendor or shop (optional)'), 'Honda Authorised');
    await user.type(screen.getByLabelText(/Odometer reading/), '48210');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));

    await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(1));
    expect(api.createExpense.mock.lastCall?.[0]).toMatchObject({
      vehicleId: VEH,
      categoryId: CAT_SERVICE,
      amount: 4850.5,
      gstAmount: 740,
      paymentMode: 'upi',
      vendor: 'Honda Authorised',
      odometerKm: 48210,
    });
  });

  it('shows the Indian-grouped amount for a large value (TC-EXP-03)', async () => {
    const user = await openNewForm();
    await user.selectOptions(screen.getByLabelText('Category'), CAT_SERVICE);
    await user.type(screen.getByLabelText('Amount (₹)'), '1,23,456.5');
    await user.selectOptions(screen.getByLabelText('Payment mode'), 'card');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalled());
    expect(api.createExpense.mock.lastCall?.[0].amount).toBe(123456.5);
  });

  it.each([
    ['0', 'Amount must be more than ₹0'],
    ['abc', 'Enter an amount in rupees'],
    ['10000001', 'at most ₹1 crore'],
  ])('blocks amount %s with a clear message (TC-EXP-02)', async (raw, msg) => {
    const user = await openNewForm();
    await user.selectOptions(screen.getByLabelText('Category'), CAT_SERVICE);
    await user.type(screen.getByLabelText('Amount (₹)'), raw);
    await user.selectOptions(screen.getByLabelText('Payment mode'), 'cash');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText(new RegExp(msg))).toBeInTheDocument();
    expect(api.createExpense).not.toHaveBeenCalled();
  });

  it('rejects GST greater than the amount', async () => {
    const user = await openNewForm();
    await user.selectOptions(screen.getByLabelText('Category'), CAT_SERVICE);
    await user.type(screen.getByLabelText('Amount (₹)'), '500');
    await user.type(screen.getByLabelText('GST included (₹, optional)'), '600');
    await user.selectOptions(screen.getByLabelText('Payment mode'), 'cash');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText('GST cannot be more than the amount.')).toBeInTheDocument();
    expect(api.createExpense).not.toHaveBeenCalled();
  });
});

describe('Odometer check (FR-EXP-07, TC-EXP-04)', () => {
  it('blocks a lower reading until a reason is given, then saves with the override noted', async () => {
    const user = await openNewForm();
    await user.selectOptions(screen.getByLabelText('Category'), CAT_SERVICE);
    await user.type(screen.getByLabelText('Amount (₹)'), '900');
    await user.selectOptions(screen.getByLabelText('Payment mode'), 'cash');
    await user.type(screen.getByLabelText(/Odometer reading/), '47000');

    expect(await screen.findByText(/lower than the last known/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save anyway' }));
    expect(await screen.findByText(/Add a reason to save it/)).toBeInTheDocument();
    expect(api.createExpense).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Reason'), 'Typo fixed from paper bill');
    await user.click(screen.getByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(1));
    expect(api.createExpense.mock.lastCall?.[0]).toMatchObject({
      odometerKm: 47000,
      notes: 'Odometer override: Typo fixed from paper bill',
    });
  });
});

describe('Edit and delete (FR-EXP-02, FR-EXP-03, TC-EXP-08)', () => {
  it('edits an amount and shows the updated value', async () => {
    const user = userEvent.setup();
    render(<ExpensesPage />);
    await user.click(await screen.findByRole('button', { name: /Edit Petrol/ }));
    const amount = screen.getByLabelText('Amount (₹)');
    await user.clear(amount);
    await user.type(amount, '5000');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() =>
      expect(api.updateExpense).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({ amount: 5000 })
      )
    );
    expect(await screen.findByText('Expense updated.')).toBeInTheDocument();
  });

  it('deletes after confirmation and removes the row', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ExpensesPage />);
    await user.click(await screen.findByRole('button', { name: /Delete Petrol/ }));
    await waitFor(() => expect(api.deleteExpense).toHaveBeenCalledWith('e1'));
    expect(await screen.findByText('No expenses yet')).toBeInTheDocument();
  });

  it('keeps the row when delete is cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ExpensesPage />);
    await user.click(await screen.findByRole('button', { name: /Delete Petrol/ }));
    expect(api.deleteExpense).not.toHaveBeenCalled();
    expect(screen.getByText('Petrol')).toBeInTheDocument();
  });

  it('shows a plain-language error when the server rejects a save', async () => {
    api.createExpense.mockRejectedValueOnce(new DataError("You don't have permission to do that."));
    const user = await openNewForm();
    await user.selectOptions(screen.getByLabelText('Category'), CAT_SERVICE);
    await user.type(screen.getByLabelText('Amount (₹)'), '100');
    await user.selectOptions(screen.getByLabelText('Payment mode'), 'cash');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText("You don't have permission to do that.")).toBeInTheDocument();
  });
});

describe('Vehicle guard', () => {
  it('asks for a vehicle first when none exists', () => {
    vehicleState.value = { vehicles: [], activeVehicle: null };
    render(<ExpensesPage />);
    expect(screen.getByText('Add a vehicle first')).toBeInTheDocument();
  });
});
