import { buildMonthGrid, firstDayOfWeek } from '@repo/ui';
import { describe, expect, it } from 'vitest';

describe('buildMonthGrid', () => {
  it('October 2026 with a Monday week start begins on Mon 28 Sep and has 42 cells', () => {
    const grid = buildMonthGrid(2026, 9, 1);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ iso: '2026-09-28', day: 28, isCurrentMonth: false });
    expect(grid[3]).toEqual({ iso: '2026-10-01', day: 1, isCurrentMonth: true });
  });

  it('en-US starts the week on Sunday, tr on Monday', () => {
    expect(firstDayOfWeek('en-US')).toBe(0);
    expect(firstDayOfWeek('tr-TR')).toBe(1);
  });
});
