import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Vehicle } from '../../data/vehicles';

const api = vi.hoisted(() => ({
  listVehicles: vi.fn(),
  listDeletedVehicles: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
  restoreVehicle: vi.fn(),
}));

vi.mock('../../data/vehicles', async (orig) => ({
  ...(await orig<typeof import('../../data/vehicles')>()),
  ...api,
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));

import { VehicleProvider } from './VehicleContext';
import { VehiclesPage } from './VehiclesPage';

const oldCar: Vehicle = {
  id: 'v-old',
  vehicleType: 'car',
  registrationNo: 'MH12AB1234',
  make: 'Maruti',
  model: 'Swift',
  fuelType: 'petrol',
  startOdometerKm: 25000,
  isArchived: false,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <VehicleProvider>
        <VehiclesPage />
      </VehicleProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
  api.listVehicles.mockResolvedValue([]);
  api.listDeletedVehicles.mockResolvedValue([]);
});

describe('T9b — deleted vehicles list', () => {
  it('lists deleted vehicles and restores one', async () => {
    api.listDeletedVehicles.mockResolvedValue([oldCar]);
    api.listVehicles.mockResolvedValue([]);
    api.restoreVehicle.mockResolvedValue(undefined);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Deleted vehicles' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore MH 12 AB 1234' }));

    await waitFor(() => expect(api.restoreVehicle).toHaveBeenCalledWith('v-old'));
    expect(await screen.findByText('Vehicle restored.')).toBeInTheDocument();
  });

  it('shows no deleted section when nothing is deleted', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Add vehicle' });
    expect(screen.queryByRole('heading', { name: 'Deleted vehicles' })).not.toBeInTheDocument();
  });
});

describe('T9b — re-adding a deleted number offers Restore', () => {
  it('stops the add and offers Restore instead of creating a duplicate', async () => {
    api.listDeletedVehicles.mockResolvedValue([oldCar]);
    api.restoreVehicle.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    await userEvent.type(screen.getByLabelText('Registration number'), 'mh 12 ab 1234');
    await userEvent.type(screen.getByLabelText(/Odometer now/), '25000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/was deleted earlier/)).toBeInTheDocument();
    expect(api.createVehicle).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Restore it' }));
    await waitFor(() => expect(api.restoreVehicle).toHaveBeenCalledWith('v-old'));
  });

  it('creates normally when the number was never deleted', async () => {
    api.createVehicle.mockResolvedValue({ ...oldCar, id: 'v-new' });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    await userEvent.type(screen.getByLabelText('Registration number'), 'KA01XY0007');
    await userEvent.type(screen.getByLabelText(/Odometer now/), '900');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.createVehicle).toHaveBeenCalledTimes(1));
    expect(api.restoreVehicle).not.toHaveBeenCalled();
  });
});
