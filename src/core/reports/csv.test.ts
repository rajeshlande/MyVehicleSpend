import { describe, it, expect } from 'vitest';
import { toCsv, withBom, money, UTF8_BOM } from './csv';

describe('CSV encoding (FR-RPT-04, TC-RPT-03)', () => {
  it('starts with the UTF-8 byte-order mark when encoded, so Excel reads UTF-8', () => {
    const bytes = new TextEncoder().encode(withBom(toCsv(['a'], [['x']])));
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('keeps ₹ and Hindi/Marathi text intact through encoding', () => {
    const csv = withBom(toCsv(['Vendor', 'Amount'], [['शर्मा मोटर्स', money(1250.5)]]));
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    const decoded = new TextDecoder('utf-8').decode(new TextEncoder().encode(csv));
    expect(decoded).toContain('शर्मा मोटर्स');
    expect(decoded).toContain('1250.50');
  });

  it('quotes commas, quotes and line breaks, and doubles inner quotes', () => {
    const csv = toCsv(['note'], [['a, "b"\nc']]);
    expect(csv).toBe('note\r\n"a, ""b""\nc"\r\n');
  });

  it('uses CRLF line endings', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2\r\n');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(toCsv(['v'], [['=HYPERLINK("x")'], ['+91 98'], ['-note'], ['@x']])).toBe(
      'v\r\n"\'=HYPERLINK(""x"")"\r\n\'+91 98\r\n\'-note\r\n\'@x\r\n'
    );
  });

  it('writes nulls as empty and money with 2 decimals', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, money(10)]])).toBe('a,b,c\r\n,,10.00\r\n');
  });
});
