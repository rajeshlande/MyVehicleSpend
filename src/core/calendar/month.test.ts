import { describe, it, expect } from 'vitest';
import { buildMonthGrid, groupByDate } from './month';

describe('buildMonthGrid', () => {
  it('starts each week on Sunday and pads with days from the neighbouring months', () => {
    // 1 Oct 2026 is a Thursday, so the first row starts on Sunday 27 Sep.
    const weeks = buildMonthGrid(2026, 10);
    expect(weeks[0]?.[0]).toEqual({ date: '2026-09-27', inMonth: false });
    expect(weeks[0]?.[4]).toEqual({ date: '2026-10-01', inMonth: true });
  });

  it('always returns full weeks of seven days', () => {
    for (const [y, m] of [
      [2026, 2],
      [2027, 2],
      [2028, 2],
      [2026, 10],
    ] as const) {
      const weeks = buildMonthGrid(y, m);
      expect(weeks.length).toBeGreaterThanOrEqual(4);
      expect(weeks.length).toBeLessThanOrEqual(6);
      for (const w of weeks) expect(w).toHaveLength(7);
    }
  });

  it('includes every day of the month exactly once, including leap February', () => {
    const feb = buildMonthGrid(2028, 2)
      .flat()
      .filter((c) => c.inMonth)
      .map((c) => c.date);
    expect(feb).toHaveLength(29);
    expect(feb[28]).toBe('2028-02-29');
  });

  it('keeps consecutive days across week boundaries', () => {
    const cells = buildMonthGrid(2026, 10).flat();
    for (let i = 1; i < cells.length; i++) {
      const prev = new Date(`${cells[i - 1]?.date}T00:00:00Z`).getTime();
      const cur = new Date(`${cells[i]?.date}T00:00:00Z`).getTime();
      expect(cur - prev).toBe(86_400_000);
    }
  });
});

describe('groupByDate', () => {
  it('groups items by their due date and skips items without one', () => {
    const grouped = groupByDate([
      { id: 'a', dueDate: '2026-10-05' },
      { id: 'b', dueDate: '2026-10-05' },
      { id: 'c', dueDate: null },
      { id: 'd', dueDate: '2026-10-09' },
    ]);
    expect(grouped.get('2026-10-05')?.map((i) => i.id)).toEqual(['a', 'b']);
    expect(grouped.get('2026-10-09')?.map((i) => i.id)).toEqual(['d']);
    expect(grouped.size).toBe(2);
  });
});
