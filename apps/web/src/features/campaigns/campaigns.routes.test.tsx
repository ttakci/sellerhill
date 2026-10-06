import { ThemeProvider } from '@emotion/react';
import { configureStore } from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';
import { type EbayCampaignDto, EbayCampaignStatus, i18nResources } from '@repo/shared';
import { lightTheme } from '@repo/ui';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { baseApi } from '../../api/baseApi';
import { App } from '../../App';
import { ActiveStoreContext } from '../ebay/hooks/useActiveStore';

import i18n from '@/i18n.config';

const context = vi.hoisted(() => ({ activeStoreId: null as string | null }));
vi.mock('../../components/ActiveStoreProvider', () => ({
  ActiveStoreProvider: ({ children }: { children: ReactNode }) => (
    <ActiveStoreContext.Provider
      value={{ activeStoreId: context.activeStoreId, stores: [], setActiveStore: () => undefined }}
    >
      {children}
    </ActiveStoreContext.Provider>
  ),
}));
vi.mock('../../components/EbayAccountGuard', () => ({
  EbayAccountGuard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../../layouts/AppLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { AppLayout: () => <Outlet /> };
});
vi.mock('../../layouts/OperatorLayout', () => ({ OperatorLayout: () => null }));
vi.mock('../landing', () => ({ default: () => null }));
vi.mock('../demo', () => ({ DemoBanner: () => null }));

const server = setupServer();
let store: ReturnType<typeof makeStore>;
function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function campaign(storeId: string): EbayCampaignDto {
  return {
    id: storeId,
    ebayAccountId: storeId,
    campaignId: '123',
    name: `${storeId} campaign`,
    status: EbayCampaignStatus.RUNNING,
    fundingModel: null,
    adRateStrategy: null,
    bidPercentage: null,
    ruleBased: false,
    createdBySellerHill: true,
    startDate: null,
    endDate: null,
    adCount: null,
    sellerHillListingCount: 1,
    readOnlyReason: null,
    syncedAt: '',
    metrics: null,
    metricsFrom: null,
    metricsTo: null,
  };
}
function response(storeId: string, detail: boolean) {
  return detail
    ? { campaign: campaign(storeId), listings: [], eligibility: { status: null, reason: null } }
    : { campaigns: [campaign(storeId)], eligibility: { status: null, reason: null } };
}
function mount(path: string) {
  window.history.replaceState({}, '', path);
  const tree = () => (
    <Provider store={store}>
      <ThemeProvider theme={lightTheme}>
        <App />
      </ThemeProvider>
    </Provider>
  );
  const view = render(tree());
  return {
    ...view,
    switchStore: (id: string | null) => {
      context.activeStoreId = id;
      view.rerender(tree());
    },
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(async () => {
  store = makeStore();
  context.activeStoreId = null;
  localStorage.setItem('locale', 'en');
  await i18n.changeLanguage('en');
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  store.dispatch(baseApi.util.resetApiState());
});
afterAll(() => server.close());

describe.each([
  { path: '/en/campaigns', endpoint: '*/campaigns', detail: false },
  { path: '/en/campaigns/123', endpoint: '*/campaigns/123', detail: true },
])('campaign route $path', ({ path, endpoint, detail }) => {
  it('skips null store, then reads the active store and clears rows before the next store resolves', async () => {
    const requests: string[] = [];
    const pendingB = deferred();
    server.use(
      http.get(endpoint, async ({ request }) => {
        const id = new URL(request.url).searchParams.get('ebayAccountId') ?? '';
        requests.push(id);
        if (id === 'store-b') {await pendingB.promise;}
        return HttpResponse.json(response(id, detail));
      })
    );
    const view = mount(path);
    await screen.findByText('Select an eBay store in the top bar.');
    expect(requests).toEqual([]);
    view.switchStore('store-a');
    await screen.findByText('store-a campaign');
    view.switchStore('store-b');
    expect(screen.queryByText('store-a campaign')).not.toBeInTheDocument();
    await waitFor(() => expect(requests).toEqual(['store-a', 'store-b']));
    await act(async () => {
      pendingB.resolve();
      await pendingB.promise;
    });
    await screen.findByText('store-b campaign');
    view.switchStore(null);
    expect(screen.queryByText('store-b campaign')).not.toBeInTheDocument();
    await screen.findByText('Select an eBay store in the top bar.');
    expect(requests).toEqual(['store-a', 'store-b']);
  });

  it('ignores a deferred old-store completion after switching stores', async () => {
    const requests: string[] = [];
    const pendingA = deferred();
    server.use(
      http.get(endpoint, async ({ request }) => {
        const id = new URL(request.url).searchParams.get('ebayAccountId') ?? '';
        requests.push(id);
        if (id === 'store-a') {await pendingA.promise;}
        return HttpResponse.json(response(id, detail));
      })
    );
    context.activeStoreId = 'store-a';
    const view = mount(path);
    await waitFor(() => expect(requests).toEqual(['store-a']));
    view.switchStore('store-b');
    await screen.findByText('store-b campaign');
    await act(async () => {
      pendingA.resolve();
      await pendingA.promise;
    });
    await waitFor(() => {
      const arg = detail ? { ebayAccountId: 'store-a', campaignId: '123' } : { ebayAccountId: 'store-a' };
      const queries = store.getState()[baseApi.reducerPath].queries;
      expect(
        Object.values(queries).some(
          (query) => query?.status === QueryStatus.fulfilled && JSON.stringify(query.originalArgs) === JSON.stringify(arg)
        )
      ).toBe(true);
    });
    expect(screen.queryByText('store-a campaign')).not.toBeInTheDocument();
    expect(screen.getByText('store-b campaign')).toBeInTheDocument();
    expect(requests).toEqual(['store-a', 'store-b']);
  });
});

it('redirects the locale-less campaign route and preserves store/query context', async () => {
  mount('/campaigns?store=store-a&view=table');
  await screen.findByText('Select an eBay store in the top bar.');
  expect(window.location.pathname).toBe('/en/campaigns');
  expect(window.location.search).toBe('?store=store-a&view=table');
});

it('registers the same campaign keys and marketing menu labels in every supported locale', () => {
  const leafKeys = (value: object, prefix = ''): string[] =>
    Object.entries(value).flatMap(([key, nested]) => {
      const full = prefix ? `${prefix}.${key}` : key;
      return typeof nested === 'object' && nested !== null ? leafKeys(nested as object, full) : [full];
    });
  const expected = leafKeys(i18nResources.en.campaigns);
  for (const resources of Object.values(i18nResources)) {
    expect(leafKeys(resources.campaigns)).toEqual(expected);
    expect(resources.translation.menu.marketing).toBeTruthy();
    expect(resources.translation.menu.campaigns).toBeTruthy();
  }
});
