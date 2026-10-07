import { DashboardRangePreset, DashboardTab } from '@repo/shared';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useDashboardUrlState } from './useDashboardUrlState';

const wrap = (url: string) => ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, { initialEntries: [url] }, children);

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

  it('an unknown preset falls back to today; a half custom range too', () => {
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?range=forever') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.TODAY });
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?from=2026-09-01') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.TODAY });
  });

  it('switching range resets the selected card', () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?card=2') });
    act(() => result.current.setRange({ preset: DashboardRangePreset.THIS_WEEK }));
    expect(result.current.card).toBe(0);
    expect(result.current.range).toEqual({ preset: DashboardRangePreset.THIS_WEEK });
  });
});
