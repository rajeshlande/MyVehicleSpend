/** Highest known odometer for a vehicle: the start reading or the largest logged reading. */
export function lastKnownOdometer(
  startOdometerKm: number,
  loggedReadings: ReadonlyArray<number | null | undefined>
): number {
  let max = startOdometerKm;
  for (const r of loggedReadings) {
    if (typeof r === 'number' && r > max) max = r;
  }
  return max;
}

export type OdometerCheck = { status: 'ok' } | { status: 'lower'; lastKnown: number };

/** Warns when a new reading is lower than the last known one (FR-EXP-07). Does not block saving. */
export function checkOdometer(entered: number | undefined, lastKnown: number): OdometerCheck {
  if (entered === undefined) return { status: 'ok' };
  return entered < lastKnown ? { status: 'lower', lastKnown } : { status: 'ok' };
}
