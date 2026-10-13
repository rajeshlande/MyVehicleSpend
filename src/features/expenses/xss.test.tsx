// T30 — TC-SEC-07: user text (vendor, notes) is shown as text, never as markup.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Expense } from '../../data/expenses';

const api = vi.hoisted(() => ({
  listCategories: vi.fn(),
  listExpenses: vi.fn(),
}));
vi.mock('../../data/expenses', async (orig) => ({
  ...(await orig<typeof import('../../data/expenses')>()),
  ...api,
}));
vi.mock('../vehicles/VehicleContext', () => ({
  useVehicles: () => ({
    vehicles: [{ id: 'v1' }],
    activeVehicle: { id: 'v1', registrationNo: 'MH12AB1234', startOdometerKm: 40000 },
  }),
}));

import { ExpensesPage } from './ExpensesPage';

const PAYLOAD = '<img src=x onerror="window.__xss = 1"><script>window.__xss = 2</script>';

const hostile: Expense = {
  id: 'e1',
  vehicleId: 'v1',
  categoryId: 'c1',
  categoryGroup: 'Fuel & Energy',
  categoryName: 'Petrol',
  expenseDate: '2026-10-01',
  amount: 4850,
  gstAmount: 0,
  paymentMode: 'upi',
  vendor: PAYLOAD,
  notes: PAYLOAD,
  receiptPaths: [],
  source: 'manual',
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as Record<string, unknown>).__xss = undefined;
  api.listCategories.mockResolvedValue([]);
  api.listExpenses.mockResolvedValue([hostile]);
});

describe('user text is shown as text (TC-SEC-07)', () => {
  it('renders a hostile vendor and note as plain text, with no injected elements or scripts run', async () => {
    const { container } = render(<ExpensesPage />);
    await waitFor(() => expect(api.listExpenses).toHaveBeenCalled());
    // The text is visible exactly as typed.
    expect(await screen.findAllByText(/<img src=x/)).not.toHaveLength(0);
    // No element was created from it.
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    // The payload did not run.
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
  });
});
