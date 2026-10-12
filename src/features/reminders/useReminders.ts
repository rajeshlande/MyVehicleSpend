import { useCallback, useEffect, useState } from 'react';
import { listReminders, type Reminder } from '../../data/reminders';
import { listFuelLogs } from '../../data/fuel';
import { listExpenses } from '../../data/expenses';
import { lastKnownOdometer } from '../../core/expenses/odometer';
import { reminderStatus, type ReminderState } from '../../core/reminders/due';
import { todayIST } from '../../core/dates/dates';

export interface ReminderView extends Reminder {
  state: ReminderState;
}

export interface VehicleLike {
  id: string;
  startOdometerKm: number;
}

/**
 * Reminders for a vehicle with their due state, plus the current odometer (highest known reading).
 * The odometer is needed only for service-by-km reminders.
 */
export function useReminders(vehicle: VehicleLike | null | undefined) {
  const [items, setItems] = useState<ReminderView[] | undefined>(undefined);
  const [currentOdometerKm, setCurrentOdometerKm] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const vehicleId = vehicle?.id;
  const startOdometerKm = vehicle?.startOdometerKm ?? 0;

  const load = useCallback(async () => {
    if (!vehicleId) return;
    try {
      const [reminders, fuel, expenses] = await Promise.all([
        listReminders(vehicleId),
        listFuelLogs(vehicleId),
        listExpenses(vehicleId),
      ]);
      const odometer = lastKnownOdometer(startOdometerKm, [
        ...fuel.map((f) => f.odometerKm),
        ...expenses.map((e) => e.odometerKm),
      ]);
      const today = todayIST();
      setCurrentOdometerKm(odometer);
      setItems(
        reminders.map((r) => ({
          ...r,
          state: reminderStatus(
            {
              dueDate: r.dueDate,
              dueOdometerKm: r.dueOdometerKm,
              leadDays: r.leadDays,
              isDone: r.isDone,
            },
            { today, currentOdometerKm: odometer }
          ),
        }))
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reminders.');
      setItems([]);
    }
  }, [vehicleId, startOdometerKm]);

  useEffect(() => {
    setItems(undefined);
    void load();
  }, [load]);

  return { items, currentOdometerKm, error, reload: load };
}
