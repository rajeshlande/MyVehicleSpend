import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { listVehicles, type Vehicle } from '../../data/vehicles';
import { useAuth } from '../auth/AuthContext';

const STORAGE_KEY = 'mvs.activeVehicleId';

interface VehicleState {
  /** undefined while loading */
  vehicles: Vehicle[] | undefined;
  activeVehicle: Vehicle | null;
  setActiveVehicleId: (id: string) => void;
  reload: () => Promise<void>;
  error: string | null;
}

const VehicleContext = createContext<VehicleState | null>(null);

/** Holds the user's vehicles and the active one (FR-VEH-04). Must sit inside a signed-in route. */
export function VehicleProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const reload = useCallback(async () => {
    try {
      setError(null);
      setVehicles(await listVehicles());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load vehicles.');
      setVehicles([]);
    }
  }, []);

  useEffect(() => {
    if (session) void reload();
  }, [session, reload]);

  const setActiveVehicleId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveId(id);
  }, []);

  const value = useMemo<VehicleState>(() => {
    const list = vehicles ?? [];
    // Fall back to the first live vehicle if the stored id was deleted or never set.
    const active = list.find((v) => v.id === activeId) ?? list[0] ?? null;
    return { vehicles, activeVehicle: active, setActiveVehicleId, reload, error };
  }, [vehicles, activeId, setActiveVehicleId, reload, error]);

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicles(): VehicleState {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error('useVehicles must be used inside <VehicleProvider>');
  return ctx;
}
