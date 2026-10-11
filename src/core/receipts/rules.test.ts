// T14 — receipt rules (FR-EXP-08, NFR-SEC-07; TC-EXP-09). Pure; no I/O.
import { describe, it, expect } from 'vitest';
import { checkReceiptFile, receiptObjectPath, nextReceiptSlot, MAX_RECEIPTS } from './rules';

const MB = 1024 * 1024;

describe('checkReceiptFile (TC-EXP-09)', () => {
  it('accepts a JPEG under 5 MB as an image', () => {
    expect(checkReceiptFile({ type: 'image/jpeg', size: 2 * MB }, 0)).toEqual({
      ok: true,
      kind: 'image',
    });
  });

  it('accepts PNG and WebP as images and PDF as a pdf', () => {
    expect(checkReceiptFile({ type: 'image/png', size: 1 * MB }, 1)).toMatchObject({
      ok: true,
      kind: 'image',
    });
    expect(checkReceiptFile({ type: 'image/webp', size: 1 * MB }, 1)).toMatchObject({
      ok: true,
      kind: 'image',
    });
    expect(checkReceiptFile({ type: 'application/pdf', size: 1 * MB }, 1)).toMatchObject({
      ok: true,
      kind: 'pdf',
    });
  });

  it('blocks a 4th receipt', () => {
    const r = checkReceiptFile({ type: 'image/jpeg', size: 1 * MB }, MAX_RECEIPTS);
    expect(r).toEqual({ ok: false, message: 'You can attach up to 3 receipts to an expense.' });
  });

  it('rejects a 6 MB JPEG before compression', () => {
    const r = checkReceiptFile({ type: 'image/jpeg', size: 6 * MB }, 0);
    expect(r).toEqual({
      ok: false,
      message: 'This file is larger than 5 MB. Choose a smaller photo.',
    });
  });

  it('rejects an .exe (wrong type) with a message', () => {
    const r = checkReceiptFile({ type: 'application/x-msdownload', size: 100 }, 0);
    expect(r).toEqual({ ok: false, message: 'Use a JPEG, PNG, WebP or PDF file.' });
  });
});

describe('storage path and slots', () => {
  it('builds the {uid}/{expense_id}/{n}.ext path (SDD §9)', () => {
    expect(receiptObjectPath('u-1', 'e-9', 2, 'jpg')).toBe('u-1/e-9/2.jpg');
    expect(receiptObjectPath('u-1', 'e-9', 1, 'pdf')).toBe('u-1/e-9/1.pdf');
  });

  it('picks the lowest free slot, so a removed receipt frees its number', () => {
    expect(nextReceiptSlot([])).toBe(1);
    expect(nextReceiptSlot(['u/e/1.jpg', 'u/e/3.jpg'])).toBe(2);
    expect(nextReceiptSlot(['u/e/1.jpg', 'u/e/2.jpg', 'u/e/3.jpg'])).toBeNull();
  });
});
