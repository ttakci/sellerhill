import { DashboardRangePreset, DashboardTab } from '@repo/shared';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useDashboardUrlState } from './useDashboardUrlState';

const wrap = (url: string) => ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, { initialEntries: [url] }, children);

/** The hook plus the router's current query string, read in the same render. */
const withSearch = () => ({ state: useDashboardUrlState(), search: useLocation().search });

describe('useDashboardUrlState', () => {
  it('defaults to today, cards, first card', () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper: wrap('/dashboard') });
    expect(result.current.range).toEqual({ preset: DashboardRangePreset.TODAY });
    expect(result.current.tab).toBe(DashboardTab.CARDS);
    expect(result.current.card).toBe(0);
  });

  it('reads a preset and a custom range', () => {
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?range=thisMonth') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.THIS_MONTH });
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?from=2026-09-01&to=2026-09-30') }).result.current.range)
      .toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('maps a legacy ?period= bookmark to the preset of the same name, unless a new param is present', () => {
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?period=thisYear') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.THIS_YEAR });
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?period=thisYear&range=thisMonth') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.THIS_MONTH });
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?period=bogus') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.TODAY });
  });

  it('an unknown preset falls back to today; a half custom range too', () => {
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?range=forever') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.TODAY });
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?from=2026-09-01') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.TODAY });
  });

  it('the default preset leaves `range` out of the URL', () => {
    const { result } = renderHook(withSearch, { wrapper: wrap('/d?range=thisMonth&card=1') });
    act(() => result.current.state.setRange({ preset: DashboardRangePreset.TODAY }));
    const params = new URLSearchParams(result.current.search);
    expect(params.has('range')).toBe(false);
    expect(params.has('card')).toBe(false);
    expect(result.current.state.range).toEqual({ preset: DashboardRangePreset.TODAY });
  });

  it('custom → preset removes from/to; preset → custom removes range', () => {
    const { result } = renderHook(withSearch, { wrapper: wrap('/d?from=2026-09-01&to=2026-09-30&tab=pnl') });
    act(() => result.current.state.setRange({ preset: DashboardRangePreset.LAST_MONTH }));
    let params = new URLSearchParams(result.current.search);
    expect(params.has('from')).toBe(false);
    expect(params.has('to')).toBe(false);
    expect(params.get('range')).toBe(DashboardRangePreset.LAST_MONTH);
    expect(params.get('tab')).toBe('pnl');

    act(() => result.current.state.setRange({ from: '2026-08-01', to: '2026-08-15' }));
    params = new URLSearchParams(result.current.search);
    expect(params.has('range')).toBe(false);
    expect(params.get('from')).toBe('2026-08-01');
    expect(params.get('to')).toBe('2026-08-15');
  });

  it('switching range resets the selected card', () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?card=2') });
    act(() => result.current.setRange({ preset: DashboardRangePreset.THIS_WEEK }));
    expect(result.current.card).toBe(0);
    expect(result.current.range).toEqual({ preset: DashboardRangePreset.THIS_WEEK });
  });
});
