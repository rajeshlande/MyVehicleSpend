// T16a/T16b UI — fuel log form and history (TC-FUEL-01, TC-FUEL-04, TC-FUEL-06 (component part), FR-FUEL-05).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Category } from '../../data/expenses';
import type { FuelLog } from '../../data/fuel';
import { DataError } from '../../data/errors';

const api = vi.hoisted(() => ({
  listFuelLogs: vi.fn(),
  addFuelLog: vi.fn(),
  listCategories: vi.fn(),
}));
vi.mock('../../data/fuel', () => ({ listFuelLogs: api.listFuelLogs, addFuelLog: api.addFuelLog }));
vi.mock('../../data/expenses', () => ({ listCategories: api.listCategories }));

const vehicleState = vi.hoisted(() => ({
  value: {
    vehicles: [] as unknown[],
    activeVehicle: null as null | {
      id: string;
      registrationNo: string;
      fuelType: string;
      startOdometerKm: number;
    },
  },
}));
vi.mock('../vehicles/VehicleContext', () => ({ useVehicles: () => vehicleState.value }));

import { FuelPage } from './FuelPage';

const VEH = '11111111-1111-4111-8111-111111111111';
const PETROL = '22222222-2222-4222-8222-222222222222';
const EV_PUBLIC = '33333333-3333-4333-8333-333333333333';

const categories: Category[] = [
  { id: PETROL, groupName: 'Fuel & Energy', name: 'Petrol' },
  { id: EV_PUBLIC, groupName: 'Fuel & Energy', name: 'EV charging (public)' },
  { id: '44444444-4444-4444-8444-444444444444', groupName: 'Insurance', name: 'Third-party' },
];

function log(over: Partial<FuelLog>): FuelLog {
  return {
    id: 'f',
    vehicleId: VEH,
    expenseId: 'e',
    filledOn: '2026-10-01',
    odometerKm: 48000,
    litres: 30,
    pricePerUnit: 100,
    totalAmount: 3000,
    isFullTank: true,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vehicleState.value = {
    vehicles: [{ id: VEH }],
    activeVehicle: {
      id: VEH,
      registrationNo: 'MH12AB1234',
      fuelType: 'petrol',
      startOdometerKm: 47000,
    },
  };
  api.listCategories.mockResolvedValue(categories);
  api.listFuelLogs.mockResolvedValue([]);
  api.addFuelLog.mockImplementation(async (input) => log({ id: 'new', ...input, totalAmount: 0 }));
});

async function openForm() {
  const user = userEvent.setup();
  render(<FuelPage />);
  await user.click(await screen.findByRole('button', { name: 'Add fuel fill' }));
  return user;
}

describe('Fuel form (FR-FUEL-01, FR-FUEL-04; TC-FUEL-01)', () => {
  it('calculates the total as you type and saves a full-tank petrol fill', async () => {
    const user = await openForm();
    await user.type(screen.getByLabelText('Odometer reading (km)'), '48000');
    await user.type(screen.getByLabelText('Litres'), '30');
    await user.type(screen.getByLabelText('Price per litre (₹)'), '100.50');
    expect(screen.getByText(/Total ₹3,015\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save fuel fill' }));

    await waitFor(() => expect(api.addFuelLog).toHaveBeenCalledTimes(1));
    expect(api.addFuelLog.mock.lastCall?.[0]).toMatchObject({
      vehicleId: VEH,
      categoryId: PETROL,
      odometerKm: 48000,
      litres: 30,
      pricePerUnit: 100.5,
      isFullTank: true,
    });
  });

  it('shows a lower odometer reading as a plain message from the database (TC-FUEL-04)', async () => {
    api.addFuelLog.mockRejectedValueOnce(
      new DataError('Odometer 46000 is lower than the last recorded reading 48000.', '23514')
    );
    const user = await openForm();
    await user.type(screen.getByLabelText('Odometer reading (km)'), '46000');
    await user.type(screen.getByLabelText('Litres'), '10');
    await user.type(screen.getByLabelText('Price per litre (₹)'), '100');
    await user.click(screen.getByRole('button', { name: 'Save fuel fill' }));
    expect(
      await screen.findByText('Odometer 46000 is lower than the last recorded reading 48000.')
    ).toBeInTheDocument();
  });

  it('turns off the full-tank toggle for a partial fill', async () => {
    const user = await openForm();
    await user.type(screen.getByLabelText('Odometer reading (km)'), '48100');
    await user.type(screen.getByLabelText('Litres'), '5');
    await user.type(screen.getByLabelText('Price per litre (₹)'), '100');
    await user.click(screen.getByLabelText('Full tank'));
    await user.click(screen.getByRole('button', { name: 'Save fuel fill' }));
    await waitFor(() => expect(api.addFuelLog).toHaveBeenCalled());
    expect(api.addFuelLog.mock.lastCall?.[0]).toMatchObject({ isFullTank: false });
  });

  it('asks for litres when they are missing, and does not save', async () => {
    const user = await openForm();
    await user.type(screen.getByLabelText('Odometer reading (km)'), '48000');
    await user.type(screen.getByLabelText('Price per litre (₹)'), '100');
    await user.click(screen.getByRole('button', { name: 'Save fuel fill' }));
    expect(await screen.findByText('Enter the litres.')).toBeInTheDocument();
    expect(api.addFuelLog).not.toHaveBeenCalled();
  });
});

describe('EV charging (FR-FUEL-05)', () => {
  beforeEach(() => {
    vehicleState.value = {
      vehicles: [{ id: VEH }],
      activeVehicle: {
        id: VEH,
        registrationNo: 'MH12EV0001',
        fuelType: 'ev',
        startOdometerKm: 1000,
      },
    };
  });

  it('asks for kWh, hides litres, and saves kWh with no litres', async () => {
    const user = await openForm();
    expect(screen.queryByLabelText('Litres')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Odometer reading (km)'), '5000');
    await user.type(screen.getByLabelText('Energy (kWh)'), '12');
    await user.type(screen.getByLabelText('Price per kWh (₹)'), '8.5');
    expect(screen.getByText(/Total ₹102\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save fuel fill' }));
    await waitFor(() => expect(api.addFuelLog).toHaveBeenCalled());
    expect(api.addFuelLog.mock.lastCall?.[0]).toMatchObject({
      energyKwh: 12,
      litres: undefined,
      categoryId: EV_PUBLIC,
    });
  });
});

describe('Fuel history (FR-FUEL-02, FR-FUEL-03; TC-FUEL-06 component part)', () => {
  it('shows km/l for each fill and the average, best and worst', async () => {
    api.listFuelLogs.mockResolvedValue([
      log({ id: 'a', filledOn: '2026-10-01', odometerKm: 48000, litres: 30 }),
      log({ id: 'b', filledOn: '2026-10-05', odometerKm: 48250, litres: 14, isFullTank: false }),
      log({ id: 'c', filledOn: '2026-10-09', odometerKm: 48500, litres: 16 }),
    ]);
    render(<FuelPage />);
    expect((await screen.findAllByText(/16\.67 km\/l/)).length).toBeGreaterThan(1);
    expect(screen.getByText(/Average 16\.67 km\/l/)).toBeInTheDocument();
    expect(screen.getByText(/Best 16\.67 km\/l on 09\/10\/2026/)).toBeInTheDocument();
  });

  it('asks for one more full tank when there is not enough data (TC-FUEL-07)', async () => {
    api.listFuelLogs.mockResolvedValue([log({ id: 'a' })]);
    render(<FuelPage />);
    expect(
      await screen.findByText('Add one more full-tank fill to see mileage.')
    ).toBeInTheDocument();
  });

  it('labels EV efficiency as km/kWh and shows kWh rather than litres', async () => {
    vehicleState.value = {
      vehicles: [{ id: VEH }],
      activeVehicle: {
        id: VEH,
        registrationNo: 'MH12EV0001',
        fuelType: 'ev',
        startOdometerKm: 1000,
      },
    };
    api.listFuelLogs.mockResolvedValue([
      log({ id: 'a', filledOn: '2026-10-01', odometerKm: 1000, litres: undefined, energyKwh: 10 }),
      log({ id: 'b', filledOn: '2026-10-08', odometerKm: 1200, litres: undefined, energyKwh: 20 }),
    ]);
    render(<FuelPage />);
    expect((await screen.findAllByText(/10\.00 km\/kWh/)).length).toBeGreaterThan(1);
    expect(screen.queryByText(/litres/i)).not.toBeInTheDocument();
  });
});
