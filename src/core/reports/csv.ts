/**
 * CSV for export (FR-RPT-04). RFC 4180 quoting, CRLF line ends, and a UTF-8 byte-order mark so Excel
 * reads ₹ and Hindi/Marathi text correctly. Text that starts with = + - @ is prefixed with an apostrophe
 * so a spreadsheet does not run it as a formula.
 */

export type CsvCell = string | number | null | undefined;

export const UTF8_BOM = '\uFEFF';

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = v;
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows as CSV text, without the BOM. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [header, ...rows].map((r) => r.map(cell).join(','));
  return lines.join('\r\n') + '\r\n';
}

/** Adds the UTF-8 BOM that Excel needs to read the file as UTF-8. */
export function withBom(csv: string): string {
  return UTF8_BOM + csv;
}

/** Money in CSV: plain number with 2 decimals, so Excel treats it as numeric. */
export function money(v: number): string {
  return v.toFixed(2);
}
