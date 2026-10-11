/**
 * Fuel efficiency and cost per km (SDD §5.6, §5.7). Pure; no I/O.
 * Algorithm: intervals run between consecutive full-tank fills. The litres for an interval are
 * all fills after the earlier full tank, up to and including the later one (partial fills included).
 */

export interface FuelFill {
  filledOn: string; // YYYY-MM-DD
  odometerKm: number;
  litres: number;
  isFull: boolean;
}

export interface MileageInterval {
  endDate: string;
  distanceKm: number;
  litres: number;
  kmpl: number;
}

export interface MileageResult {
  status: 'ok' | 'insufficient';
  message?: string;
  intervals: MileageInterval[];
  averageKmpl?: number; // total km / total litres over valid intervals
  best?: { kmpl: number; endDate: string };
  worst?: { kmpl: number; endDate: string };
}

const MIN_KM = 50;

export function computeMileage(fills: readonly FuelFill[]): MileageResult {
  const sorted = [...fills].sort((a, b) => a.odometerKm - b.odometerKm);
  const fullIdx = sorted.map((f, i) => (f.isFull ? i : -1)).filter((i) => i >= 0);

  const intervals: MileageInterval[] = [];
  for (let k = 1; k < fullIdx.length; k++) {
    const prev = fullIdx[k - 1]!;
    const cur = fullIdx[k]!;
    const distanceKm = sorted[cur]!.odometerKm - sorted[prev]!.odometerKm;
    let litres = 0;
    for (let j = prev + 1; j <= cur; j++) litres += sorted[j]!.litres;
    if (distanceKm <= 0 || litres <= 0) continue; // reject, do not count
    intervals.push({
      endDate: sorted[cur]!.filledOn,
      distanceKm,
      litres,
      kmpl: distanceKm / litres,
    });
  }

  if (fullIdx.length < 2) {
    return {
      status: 'insufficient',
      message: 'Add one more full-tank fill to see mileage.',
      intervals,
    };
  }
  const totalDistance =
    sorted[fullIdx[fullIdx.length - 1]!]!.odometerKm - sorted[fullIdx[0]!]!.odometerKm;
  if (totalDistance < MIN_KM) {
    return {
      status: 'insufficient',
      message: `Not enough distance yet. Mileage needs at least ${MIN_KM} km.`,
      intervals,
    };
  }
  if (intervals.length === 0) {
    return {
      status: 'insufficient',
      message: 'Add more fills with increasing odometer readings.',
      intervals,
    };
  }

  const sumKm = intervals.reduce((s, i) => s + i.distanceKm, 0);
  const sumL = intervals.reduce((s, i) => s + i.litres, 0);
  let best = intervals[0]!;
  let worst = intervals[0]!;
  for (const i of intervals) {
    if (i.kmpl > best.kmpl) best = i;
    if (i.kmpl < worst.kmpl) worst = i;
  }
  return {
    status: 'ok',
    intervals,
    averageKmpl: sumKm / sumL,
    best: { kmpl: best.kmpl, endDate: best.endDate },
    worst: { kmpl: worst.kmpl, endDate: worst.endDate },
  };
}

export type CostPerKmResult =
  { status: 'ok'; perKm: number } | { status: 'insufficient'; message: string };

/** Spend in a period divided by odometer distance (SDD §5.7). Rounded to paise per km. */
export function costPerKm(spend: number, odoStart: number, odoEnd: number): CostPerKmResult {
  const distance = odoEnd - odoStart;
  if (distance < MIN_KM) {
    return {
      status: 'insufficient',
      message: `Not enough distance yet. Cost per km needs at least ${MIN_KM} km.`,
    };
  }
  return { status: 'ok', perKm: Math.round((spend / distance) * 100) / 100 };
}
