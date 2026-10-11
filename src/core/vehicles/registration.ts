/**
 * Indian registration number rules (FR-VEH-06, schema CHECK `^[A-Z0-9]{4,12}$`).
 * Permissive by design: state codes, BH-series and unusual formats are all allowed.
 */
const VALID = /^[A-Z0-9]{4,12}$/;
const STANDARD = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/;

/** Upper-case and remove spaces and hyphens, so users can type it however they like. */
export function normalizeRegistration(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidRegistration(normalized: string): boolean {
  return VALID.test(normalized);
}

/** Display form such as "MH 12 AB 1234". Unusual formats are returned unchanged. */
export function formatRegistration(normalized: string): string {
  const m = STANDARD.exec(normalized);
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : normalized;
}
