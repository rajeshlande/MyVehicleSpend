// Invoices screen: service bills for a vehicle (list, create, mark paid). Migration 0015.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ServiceBill } from '../../data/serviceBills';
import { formatINR } from '../../core/money/money';

const api = vi.hoisted(() => ({
  listServiceBills: vi.fn(),
  createServiceBill: vi.fn(),
  markServiceBillPaid: vi.fn(),
}));
vi.mock('../../data/serviceBills', () => api);

const vehicleState = vi.hoisted(() => ({
  value: {
    vehicles: [] as unknown[],
    activeVehicle: null as null | { id: string; registrationNo: string },
  },
}));
vi.mock('../vehicles/VehicleContext', () => ({ useVehicles: () => vehicleState.value }));

import { InvoicesPage } from './InvoicesPage';

const VEH = '11111111-1111-4111-8111-111111111111';

function bill(over: Partial<ServiceBill> = {}): ServiceBill {
  return {
    id: 'b1',
    vehicleId: VEH,
    billNo: 'SB-101',
    vendor: 'Sharma Motors',
    issueDate: '2026-10-01',
    dueDate: '2026-10-15',
    status: 'unpaid',
    subtotal: 1200,
    tax: 0,
    total: 1200,
    lines: [{ id: 'i1', description: 'Engine oil', quantity: 1, unitPrice: 1200, amount: 1200 }],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vehicleState.value = {
    vehicles: [{ id: VEH }],
    activeVehicle: { id: VEH, registrationNo: 'MH01AB1234' },
  };
  api.listServiceBills.mockResolvedValue([bill()]);
  api.markServiceBillPaid.mockResolvedValue(undefined);
  api.createServiceBill.mockResolvedValue({ id: 'b2' });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <InvoicesPage />
    </MemoryRouter>
  );
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Add bill' }));
}

describe('Invoices list', () => {
  it('lists the bills for the active vehicle with their total and status', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Service bills' });
    expect(within(list).getByText('SB-101')).toBeInTheDocument();
    expect(within(list).getByText('Sharma Motors')).toBeInTheDocument();
    expect(within(list).getByText(formatINR(1200))).toBeInTheDocument();
    expect(within(list).getByText('Unpaid')).toBeInTheDocument();
    expect(api.listServiceBills).toHaveBeenCalledWith(VEH);
  });

  it('shows an empty state when there are no bills', async () => {
    api.listServiceBills.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No service bills yet')).toBeInTheDocument();
  });

  it('asks for a vehicle first when there is none', () => {
    vehicleState.value = { vehicles: [], activeVehicle: null };
    renderPage();
    expect(screen.getByText('Add a vehicle first')).toBeInTheDocument();
  });

  it('marks an unpaid bill as paid', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Mark SB-101 as paid' }));
    expect(api.markServiceBillPaid).toHaveBeenCalledWith('b1');
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark SB-101 as paid' })).toBeNull();
  });
});

describe('Create service bill', () => {
  it('shows the total as lines are entered (paise-exact, with tax)', async () => {
    const user = userEvent.setup();
    renderPage();
    await openForm(user);
    await user.type(screen.getByLabelText('Item description'), 'Oil filter');
    await user.clear(screen.getByLabelText('Quantity'));
    await user.type(screen.getByLabelText('Quantity'), '2');
    await user.type(screen.getByLabelText('Unit price (₹)'), '150.5');
    await user.type(screen.getByLabelText('Tax (₹)'), '10');
    expect(screen.getByText(/Total/)).toHaveTextContent(formatINR(311));
  });

  it('saves a valid bill and shows it in the list', async () => {
    const user = userEvent.setup();
    api.listServiceBills
      .mockResolvedValueOnce([])
      .mockResolvedValue([bill({ id: 'b2', billNo: 'SB-202', vendor: 'Garage Co', total: 300 })]);
    renderPage();
    await openForm(user);
    await user.type(screen.getByLabelText('Bill number'), 'SB-202');
    await user.type(screen.getByLabelText('Garage or service centre'), 'Garage Co');
    await user.type(screen.getByLabelText('Item description'), 'Wash');
    await user.type(screen.getByLabelText('Unit price (₹)'), '300');
    await user.click(screen.getByRole('button', { name: 'Save bill' }));

    await waitFor(() =>
      expect(api.createServiceBill).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicleId: VEH,
          billNo: 'SB-202',
          vendor: 'Garage Co',
          tax: 0,
          items: [{ description: 'Wash', quantity: 1, unitPrice: 300 }],
        })
      )
    );
    expect(await screen.findByText('SB-202')).toBeInTheDocument();
  });

  it('blocks a due date before the issue date and does not save', async () => {
    const user = userEvent.setup();
    renderPage();
    await openForm(user);
    await user.type(screen.getByLabelText('Bill number'), 'SB-303');
    await user.type(screen.getByLabelText('Garage or service centre'), 'Garage Co');
    await user.type(screen.getByLabelText('Item description'), 'Wash');
    await user.type(screen.getByLabelText('Unit price (₹)'), '300');
    await user.clear(screen.getByLabelText('Issue date'));
    await user.type(screen.getByLabelText('Issue date'), '2026-10-10');
    await user.type(screen.getByLabelText('Due date (optional)'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Save bill' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The due date cannot be before the issue date.'
    );
    expect(api.createServiceBill).not.toHaveBeenCalled();
  });

  it('lets the user add and remove an item line', async () => {
    const user = userEvent.setup();
    renderPage();
    await openForm(user);
    expect(screen.getAllByLabelText('Item description')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getAllByLabelText('Item description')).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: 'Remove item' })[1]!);
    expect(screen.getAllByLabelText('Item description')).toHaveLength(1);
  });
});
