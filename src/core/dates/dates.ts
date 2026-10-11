const IST = 'Asia/Kolkata';

/** YYYY-MM-DD for a moment, in Indian time. */
export function isoDateIST(d: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function todayIST(now: Date = new Date()): string {
  return isoDateIST(now);
}

/** Indian financial year that a date falls in: 1 April (year) to 31 March (year + 1). */
export function fiscalYearOf(isoDate: string): number {
  const [y, m] = isoDate.split('-').map(Number) as [number, number, number];
  return m >= 4 ? y : y - 1;
}

export function fyRange(startYear: number): { from: string; to: string } {
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

/** DD/MM/YYYY for display (UI/UX §7). */
export function formatDMY(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** True when the date is later than tomorrow relative to `today` (both YYYY-MM-DD). */
export function isFutureBeyondTomorrow(isoDate: string, today: string): boolean {
  const addDay = (iso: string) => {
    const t = new Date(`${iso}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString().slice(0, 10);
  };
  return isoDate > addDay(today);
}
