import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveStoreProvider } from './ActiveStoreProvider';

import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { activeStoreStorageKey } from '@/features/ebay/utils/activeStore';

const STORES = [
  { id: 'a', storeName: 'Store A', ebayUsername: '', sellerId: 'sa' },
  { id: 'b', storeName: 'Store B', ebayUsername: '', sellerId: 'sb' },
];

// The store slice already holds the signed-in user (AuthBootstrap / login put it
// there); `/auth/me` is NOT answered yet — the remembered store must still win.
vi.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { isAuthenticated: true, user: { id: 'u1' }, authReady: true } }),
}));
vi.mock('@/features/auth/api/authApi', () => ({ useGetMeQuery: () => ({ data: undefined }) }));
vi.mock('@/features/ebay/api/ebayApi', () => ({ useGetEbayAccountsQuery: () => ({ data: { items: STORES } }) }));

const control: { switchTo: (id: string) => void } = { switchTo: () => undefined };
const Probe = (): React.ReactElement => {
  const { activeStoreId, setActiveStore } = useActiveStore();
  const location = useLocation();
  React.useEffect(() => {
    control.switchTo = (id) => setActiveStore(id);
  }, [setActiveStore]);
  return <span data-testid="probe">{`${activeStoreId ?? 'none'}|${location.pathname}${location.search}`}</span>;
};

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/:locale/*"
          element={
            <ActiveStoreProvider>
              <Probe />
            </ActiveStoreProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('ActiveStoreProvider', () => {
  beforeEach(() => window.localStorage.clear());

  it('opens on the remembered store even before /auth/me answers', () => {
    window.localStorage.setItem(activeStoreStorageKey('u1'), 'b');
    renderAt('/en/orders');
    expect(screen.getByTestId('probe').textContent).toBe('b|/en/orders?store=b');
  });

  it('corrects a foreign ?store= instead of using it', () => {
    renderAt('/en/orders?store=zzz&tab=action');
    expect(screen.getByTestId('probe').textContent).toBe('a|/en/orders?store=a&tab=action');
  });

  it('a manual switch on a record page goes to that list, keeping nothing of the record', () => {
    renderAt('/en/orders/123?store=a');
    act(() => control.switchTo('b'));
    expect(screen.getByTestId('probe').textContent).toBe('b|/en/orders?store=b');
  });

  it('a manual switch on a list keeps the view and drops the page', () => {
    renderAt('/en/dashboard?store=a&tab=chart&page=3');
    act(() => control.switchTo('b'));
    expect(screen.getByTestId('probe').textContent).toBe('b|/en/dashboard?store=b&tab=chart');
  });
});
