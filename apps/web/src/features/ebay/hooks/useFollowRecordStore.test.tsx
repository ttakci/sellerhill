import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ActiveStoreContext, type ActiveStoreContextValue } from './useActiveStore';
import { useFollowRecordStore } from './useFollowRecordStore';

const wrapperFor = (value: ActiveStoreContextValue) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ActiveStoreContext.Provider value={value}>{children}</ActiveStoreContext.Provider>;
  };

const contextWith = (activeStoreId: string | null) => {
  const setActiveStore = vi.fn();
  return { value: { activeStoreId, stores: [], setActiveStore }, setActiveStore };
};

describe('useFollowRecordStore', () => {
  it("switches to the record's store, keeping the page's own params", () => {
    const { value, setActiveStore } = contextWith('a');
    renderHook(() => useFollowRecordStore('b'), { wrapper: wrapperFor(value) });
    expect(setActiveStore).toHaveBeenCalledWith('b', { keepParams: true });
  });
  it('does nothing when the record is already on the active store', () => {
    const { value, setActiveStore } = contextWith('a');
    renderHook(() => useFollowRecordStore('a'), { wrapper: wrapperFor(value) });
    expect(setActiveStore).not.toHaveBeenCalled();
  });
  it('does nothing before the record (or the store) is known', () => {
    const { value, setActiveStore } = contextWith('a');
    renderHook(() => useFollowRecordStore(undefined), { wrapper: wrapperFor(value) });
    const none = contextWith(null);
    renderHook(() => useFollowRecordStore('b'), { wrapper: wrapperFor(none.value) });
    expect(setActiveStore).not.toHaveBeenCalled();
    expect(none.setActiveStore).not.toHaveBeenCalled();
  });
});
