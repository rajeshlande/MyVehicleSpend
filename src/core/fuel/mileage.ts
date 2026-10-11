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
  // Positions of full-tank fills in the sorted list.
  const fulls = sorted.flatMap((f, i) => (f.isFull ? [{ fill: f, index: i }] : []));

  const intervals: MileageInterval[] = [];
  for (let k = 1; k < fulls.length; k++) {
    const prev = fulls[k - 1];
    const cur = fulls[k];
    if (!prev || !cur) continue;
    const distanceKm = cur.fill.odometerKm - prev.fill.odometerKm;
    let litres = 0;
    for (let j = prev.index + 1; j <= cur.index; j++) litres += sorted[j]?.litres ?? 0;
    if (distanceKm <= 0 || litres <= 0) continue; // reject, do not count
    intervals.push({ endDate: cur.fill.filledOn, distanceKm, litres, kmpl: distanceKm / litres });
  }

  if (fulls.length < 2) {
    return {
      status: 'insufficient',
      message: 'Add one more full-tank fill to see mileage.',
      intervals,
    };
  }
  const first = fulls[0];
  const last = fulls[fulls.length - 1];
  const totalDistance = (last?.fill.odometerKm ?? 0) - (first?.fill.odometerKm ?? 0);
  if (totalDistance < MIN_KM) {
    return {
      status: 'insufficient',
      message: `Not enough distance yet. Mileage needs at least ${MIN_KM} km.`,
      intervals,
    };
  }
  const firstInterval = intervals[0];
  if (!firstInterval) {
    return {
      status: 'insufficient',
      message: 'Add more fills with increasing odometer readings.',
      intervals,
    };
  }

  const sumKm = intervals.reduce((s, i) => s + i.distanceKm, 0);
  const sumL = intervals.reduce((s, i) => s + i.litres, 0);
  let best = firstInterval;
  let worst = firstInterval;
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
