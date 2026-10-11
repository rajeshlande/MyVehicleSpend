// T10 — money utilities (FR-EXP-06, NFR-USE-02; TC-EXP-02, TC-EXP-03).
import { describe, it, expect } from 'vitest';
import {
  round2,
  toPaise,
  fromPaise,
  sumMoney,
  formatINR,
  parseMoneyInput,
  isValidAmount,
} from './money';

describe('round2 and paise arithmetic', () => {
  it('rounds to two decimals without float drift', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(toPaise(32.5 * 102.4)).toBe(332800);
    expect(fromPaise(332800)).toBe(3328);
  });

  it('sums in paise so totals match exactly', () => {
    // 0.1 + 0.2 + 0.3 is 0.6000000000000001 in floats; the total must be exact.
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumMoney([])).toBe(0);
  });
});

describe('formatINR (Indian grouping)', () => {
  it('formats with lakh grouping and two decimals', () => {
    expect(formatINR(123456)).toBe('₹1,23,456.00');
    expect(formatINR(3328)).toBe('₹3,328.00');
    expect(formatINR(10000000)).toBe('₹1,00,00,000.00');
    expect(formatINR(0)).toBe('₹0.00');
  });
});

describe('parseMoneyInput (TC-EXP-03)', () => {
  it('accepts plain and Indian-grouped input', () => {
    expect(parseMoneyInput('123456.5')).toBe(123456.5);
    expect(parseMoneyInput('1,23,456.5')).toBe(123456.5);
    expect(parseMoneyInput('₹ 4,850')).toBe(4850);
  });
  it('rejects letters, too many decimals and empty input', () => {
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('10.123')).toBeNull();
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('1.2.3')).toBeNull();
  });
});

describe('isValidAmount (TC-EXP-02 boundaries)', () => {
  it.each([
    [0, false],
    [0.01, true],
    [10000000, true],
    [10000000.01, false],
    [-5, false],
    [Number.NaN, false],
  ])('amount %s → %s', (amount, ok) => {
    expect(isValidAmount(amount)).toBe(ok);
  });
});
