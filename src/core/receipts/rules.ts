/** Receipt rules (FR-EXP-08, NFR-SEC-07, SDD §9). Pure; no I/O. */

export const MAX_RECEIPTS = 3;
export const MAX_RAW_BYTES = 5 * 1024 * 1024;
export const TARGET_BYTES = 1024 * 1024; // browser compression target for images

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PDF_TYPE = 'application/pdf';

export type ReceiptKind = 'image' | 'pdf';
export type ReceiptCheck = { ok: true; kind: ReceiptKind } | { ok: false; message: string };

/** Checks a file before upload. Order: type, size, then count. */
export function checkReceiptFile(
  file: { type: string; size: number },
  existingCount: number
): ReceiptCheck {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isPdf = file.type === PDF_TYPE;
  if (!isImage && !isPdf) return { ok: false, message: 'Use a JPEG, PNG, WebP or PDF file.' };
  if (file.size > MAX_RAW_BYTES) {
    return { ok: false, message: 'This file is larger than 5 MB. Choose a smaller photo.' };
  }
  if (existingCount >= MAX_RECEIPTS) {
    return { ok: false, message: `You can attach up to ${MAX_RECEIPTS} receipts to an expense.` };
  }
  return { ok: true, kind: isPdf ? 'pdf' : 'image' };
}

/** Storage object path. The first folder must equal auth.uid() (storage policy, migration 0008). */
export function receiptObjectPath(
  uid: string,
  expenseId: string,
  n: number,
  ext: 'jpg' | 'pdf'
): string {
  return `${uid}/${expenseId}/${n}.${ext}`;
}

/** Lowest free slot number 1..MAX_RECEIPTS, or null when all slots are used. */
export function nextReceiptSlot(paths: readonly string[]): number | null {
  const used = new Set(paths.map((p) => Number(p.split('/').pop()?.split('.')[0])));
  for (let n = 1; n <= MAX_RECEIPTS; n++) if (!used.has(n)) return n;
  return null;
}
