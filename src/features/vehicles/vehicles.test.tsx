import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Vehicle } from '../../data/vehicles';
import { DataError } from '../../data/errors';

const api = vi.hoisted(() => ({
  listVehicles: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
}));

vi.mock('../../data/vehicles', async (orig) => ({
  ...(await orig<typeof import('../../data/vehicles')>()),
  listVehicles: api.listVehicles,
  createVehicle: api.createVehicle,
  updateVehicle: api.updateVehicle,
  deleteVehicle: api.deleteVehicle,
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));

import { VehicleProvider } from './VehicleContext';
import { VehiclesPage } from './VehiclesPage';

const car: Vehicle = {
  id: 'v1',
  vehicleType: 'car',
  registrationNo: 'MH12AB1234',
  make: 'Maruti',
  model: 'Swift',
  fuelType: 'petrol',
  startOdometerKm: 25000,
  isArchived: false,
};
const bike: Vehicle = {
  id: 'v2',
  vehicleType: 'bike',
  registrationNo: 'KA01XY0007',
  fuelType: 'petrol',
  startOdometerKm: 900,
  isArchived: false,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <VehicleProvider>
        <VehiclesPage />
      </VehicleProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
  api.listVehicles.mockResolvedValue([]);
});

describe('TC-VEH-01 — add a car', () => {
  it('normalises the registration and saves the vehicle', async () => {
    api.createVehicle.mockResolvedValue({ ...car });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    await userEvent.type(screen.getByLabelText('Registration number'), 'mh 12 ab 1234');
    await userEvent.type(screen.getByLabelText(/^Make/), 'Maruti');
    await userEvent.type(screen.getByLabelText(/^Model/), 'Swift');
    await userEvent.type(screen.getByLabelText(/Odometer now/), '25000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.createVehicle).toHaveBeenCalledTimes(1));
    expect(api.createVehicle).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleType: 'car',
        registrationNo: 'MH12AB1234',
        make: 'Maruti',
        model: 'Swift',
        fuelType: 'petrol',
        startOdometerKm: 25000,
      }),
    );
  });
});

describe('TC-VEH-02 — add a bike', () => {
  it('saves a bike with the bike type and no make or model', async () => {
    api.createVehicle.mockResolvedValue({ ...bike });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    await userEvent.selectOptions(screen.getByLabelText('Vehicle type'), 'bike');
    await userEvent.type(screen.getByLabelText('Registration number'), 'KA01XY0007');
    await userEvent.type(screen.getByLabelText(/Odometer now/), '900');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.createVehicle).toHaveBeenCalledTimes(1));
    expect(api.createVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleType: 'bike', registrationNo: 'KA01XY0007', startOdometerKm: 900 }),
    );
    expect(api.createVehicle.mock.calls[0]![0].make).toBeUndefined();
  });
});

describe('TC-VEH-04 — invalid registration', () => {
  it('shows a plain message and does not call the API', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    await userEvent.type(screen.getByLabelText('Registration number'), 'AB-@@');
    await userEvent.type(screen.getByLabelText(/Odometer now/), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Registration number must be/);
    expect(api.createVehicle).not.toHaveBeenCalled();
  });

  it('requires an odometer reading', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    await userEvent.type(screen.getByLabelText('Registration number'), 'MH12AB1234');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the odometer reading in km.');
    expect(api.createVehicle).not.toHaveBeenCalled();
  });
});

describe('TC-VEH-03 — duplicate registration', () => {
  it('shows the duplicate message from the data layer', async () => {
    api.createVehicle.mockRejectedValue(new DataError('A vehicle with this number already exists.', '23505'));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    await userEvent.type(screen.getByLabelText('Registration number'), 'MH12AB1234');
    await userEvent.type(screen.getByLabelText(/Odometer now/), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A vehicle with this number already exists.');
  });
});

describe('TC-VEH-05 — edit a vehicle', () => {
  it('updates the chosen vehicle with the new make', async () => {
    api.listVehicles.mockResolvedValue([car]);
    api.updateVehicle.mockResolvedValue({ ...car, make: 'Suzuki' });
    renderPage();
    const card = (await screen.findByText('MH 12 AB 1234')).closest('li')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const make = screen.getByLabelText(/^Make/);
    await userEvent.clear(make);
    await userEvent.type(make, 'Suzuki');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateVehicle).toHaveBeenCalledTimes(1));
    expect(api.updateVehicle).toHaveBeenCalledWith('v1', expect.objectContaining({ make: 'Suzuki', isArchived: false }));
  });
});

describe('TC-VEH-07 — switch active vehicle', () => {
  it('makes the chosen vehicle active and remembers it', async () => {
    api.listVehicles.mockResolvedValue([car, bike]);
    renderPage();
    const bikeCard = (await screen.findByText('KA 01 XY 0007')).closest('li')!;
    expect(within(bikeCard).getByRole('button', { name: 'Make active' })).toBeInTheDocument();
    await userEvent.click(within(bikeCard).getByRole('button', { name: 'Make active' }));
    expect(localStorage.getItem('mvs.activeVehicleId')).toBe('v2');
    expect(within(bikeCard).getByText('Active')).toBeInTheDocument();
  });

  it('keeps the first vehicle active by default', async () => {
    api.listVehicles.mockResolvedValue([car, bike]);
    renderPage();
    const carCard = (await screen.findByText('MH 12 AB 1234')).closest('li')!;
    expect(within(carCard).getByText('Active')).toBeInTheDocument();
  });
});

describe('TC-VEH-06 — delete with typed confirmation', () => {
  it('keeps the delete button disabled until DELETE is typed, then deletes', async () => {
    api.listVehicles.mockResolvedValue([car]);
    api.deleteVehicle.mockResolvedValue(undefined);
    renderPage();
    const card = (await screen.findByText('MH 12 AB 1234')).closest('li')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete vehicle' });
    expect(confirm).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText('Type DELETE'), 'delete');
    expect(confirm).toBeDisabled(); // case must match exactly

    await userEvent.clear(within(dialog).getByLabelText('Type DELETE'));
    await userEvent.type(within(dialog).getByLabelText('Type DELETE'), 'DELETE');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(api.deleteVehicle).toHaveBeenCalledWith('v1'));
  });
});

describe('empty state', () => {
  it('invites the user to add a vehicle', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Add your car or bike' })).toBeInTheDocument();
  });
});
