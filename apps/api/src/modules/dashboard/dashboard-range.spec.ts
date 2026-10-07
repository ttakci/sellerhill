import {
  DashboardChartGranularity as G,
  DashboardPeriodUnit,
  DashboardRangeError,
  DashboardRangePreset as P,
  dashboardBucketKeys,
  dashboardBucketWindows,
  resolveDashboardRange,
} from '@repo/shared';

// 2026-10-07 is a Wednesday; Monday of its week is 10-05.
const TODAY = '2026-10-07';
const win = (p: { from: string; to: string }) => `${p.from}..${p.to}`;

describe('resolveDashboardRange — calendar presets', () => {
  it('today: today, yesterday, 2 and 3 days ago; hourly chart', () => {
    const r = resolveDashboardRange({ preset: P.TODAY }, TODAY);
    expect(r.periods.map(win)).toEqual([
      '2026-10-07..2026-10-07', '2026-10-06..2026-10-06', '2026-10-05..2026-10-05', '2026-10-04..2026-10-04',
    ]);
    expect(win(r.periods[0].comparison)).toBe('2026-10-06..2026-10-06');
    expect(r.periods.map((p) => p.label.offset)).toEqual([0, 1, 2, 3]);
    expect(r.periods[0].label.unit).toBe(DashboardPeriodUnit.DAY);
    expect(r.chartGranularity).toBe(G.HOUR);
    expect(r.pnlGranularity).toBe(G.DAY);
  });

  it('yesterday starts the chain one day back', () => {
    const r = resolveDashboardRange({ preset: P.YESTERDAY }, TODAY);
    expect(win(r.range)).toBe('2026-10-06..2026-10-06');
    expect(r.periods.map((p) => p.label.offset)).toEqual([1, 2, 3, 4]);
  });

  it('thisWeek is to-date and compares the same elapsed days of last week', () => {
    const r = resolveDashboardRange({ preset: P.THIS_WEEK }, TODAY);
    expect(win(r.periods[0])).toBe('2026-10-05..2026-10-07');
    expect(win(r.periods[0].comparison)).toBe('2026-09-28..2026-09-30');
    expect(win(r.periods[1])).toBe('2026-09-28..2026-10-04');
    expect(win(r.periods[1].comparison)).toBe('2026-09-21..2026-09-27');
  });

  it('thisMonth: month-to-date, then full previous months', () => {
    const r = resolveDashboardRange({ preset: P.THIS_MONTH }, TODAY);
    expect(r.periods.map(win)).toEqual([
      '2026-10-01..2026-10-07', '2026-09-01..2026-09-30', '2026-08-01..2026-08-31', '2026-07-01..2026-07-31',
    ]);
    expect(win(r.periods[0].comparison)).toBe('2026-09-01..2026-09-07');
    expect(win(r.periods[3].comparison)).toBe('2026-06-01..2026-06-30');
    expect(r.chartGranularity).toBe(G.DAY);
  });

  it('clamps the to-date comparison at the end of a shorter month', () => {
    const r = resolveDashboardRange({ preset: P.THIS_MONTH }, '2026-03-31');
    expect(win(r.periods[0].comparison)).toBe('2026-02-01..2026-02-28');
  });

  it('clamps when the offset would spill into the next month (03-30)', () => {
    const r = resolveDashboardRange({ preset: P.THIS_MONTH }, '2026-03-30');
    expect(win(r.periods[0].comparison)).toBe('2026-02-01..2026-02-28');
  });

  it('thisYear compares the same days of last year; monthly chart', () => {
    const r = resolveDashboardRange({ preset: P.THIS_YEAR }, TODAY);
    expect(win(r.periods[0])).toBe('2026-01-01..2026-10-07');
    expect(win(r.periods[0].comparison)).toBe('2025-01-01..2025-10-07');
    expect(r.chartGranularity).toBe(G.MONTH);
  });

  it('lastMonth is a full month with a full-month comparison', () => {
    const r = resolveDashboardRange({ preset: P.LAST_MONTH }, TODAY);
    expect(win(r.periods[0])).toBe('2026-09-01..2026-09-30');
    expect(win(r.periods[0].comparison)).toBe('2026-08-01..2026-08-31');
  });
});

describe('resolveDashboardRange — rolling presets and custom ranges', () => {
  it('last7Days steps back by 7 days', () => {
    const r = resolveDashboardRange({ preset: P.LAST_7_DAYS }, TODAY);
    expect(r.periods.slice(0, 2).map(win)).toEqual(['2026-10-01..2026-10-07', '2026-09-24..2026-09-30']);
    expect(r.periods[0].label).toEqual({ unit: DashboardPeriodUnit.SPAN, offset: 0, preset: P.LAST_7_DAYS });
    expect(r.periods[1].label.preset).toBeNull();
  });

  it('last3Months is 92 days → weekly', () => {
    const r = resolveDashboardRange({ preset: P.LAST_3_MONTHS }, TODAY);
    expect(win(r.range)).toBe('2026-07-08..2026-10-07');
    expect(r.chartGranularity).toBe(G.WEEK);
  });

  it('last12Months → monthly', () => {
    const r = resolveDashboardRange({ preset: P.LAST_12_MONTHS }, TODAY);
    expect(win(r.range)).toBe('2025-10-08..2026-10-07');
    expect(r.chartGranularity).toBe(G.MONTH);
  });

  it('a custom range steps back by its own length', () => {
    const r = resolveDashboardRange({ from: '2026-09-10', to: '2026-09-19' }, TODAY);
    expect(r.preset).toBeNull();
    expect(r.periods.slice(0, 2).map(win)).toEqual(['2026-09-10..2026-09-19', '2026-08-31..2026-09-09']);
    expect(win(r.periods[0].comparison)).toBe('2026-08-31..2026-09-09');
  });

  it.each([
    [{ from: '2026-10-01', to: '2026-10-08' }, 'to after today'],
    [{ from: '2026-10-05', to: '2026-10-01' }, 'from after to'],
    [{ from: '2026-02-31', to: '2026-03-01' }, 'not a real date'],
    [{ from: '2024-10-06', to: '2026-10-07' }, 'longer than 731 days'],
  ])('refuses %j (%s)', (input) => {
    expect(() => resolveDashboardRange(input, TODAY)).toThrow(DashboardRangeError);
  });

  it('refuses an unknown preset', () => {
    expect(() => resolveDashboardRange({ preset: 'nope' as P }, TODAY)).toThrow(DashboardRangeError);
    expect(() => resolveDashboardRange({ preset: 'constructor' as P }, TODAY)).toThrow(DashboardRangeError);
  });
});

describe('bucket keys and windows', () => {
  it('hour keys match to_char(…, YYYY-MM-DD HH24)', () => {
    const keys = dashboardBucketKeys({ from: TODAY, to: TODAY }, G.HOUR);
    expect(keys).toHaveLength(24);
    expect(keys[0]).toBe('2026-10-07 00');
    expect(keys[23]).toBe('2026-10-07 23');
  });

  it('week keys start on the Monday on or before `from`', () => {
    const keys = dashboardBucketKeys({ from: '2026-07-08', to: TODAY }, G.WEEK);
    expect(keys[0]).toBe('2026-07-06');
    expect(keys[keys.length - 1]).toBe('2026-10-05');
    expect(keys).toHaveLength(14);
  });

  it('month windows are clipped to the range', () => {
    const w = dashboardBucketWindows({ from: '2026-01-01', to: TODAY }, G.MONTH);
    expect(w[0]).toEqual({ key: '2026-01-01', from: '2026-01-01', to: '2026-01-31' });
    expect(w[w.length - 1]).toEqual({ key: '2026-10-01', from: '2026-10-01', to: TODAY });
  });

  it('day windows are one per day', () => {
    const w = dashboardBucketWindows({ from: '2026-10-01', to: TODAY }, G.DAY);
    expect(w).toHaveLength(7);
    expect(w[6]).toEqual({ key: TODAY, from: TODAY, to: TODAY });
  });
});
