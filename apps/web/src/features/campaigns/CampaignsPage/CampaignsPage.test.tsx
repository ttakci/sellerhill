import { ThemeProvider } from '@emotion/react';
import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';
import {
  CampaignReadOnlyReason,
  EbayAdRateStrategy,
  EbayMarketplaceId,
  EbayAccountStatus,
  type EbayAccountPublicDto,
  EbayCampaignFundingModel,
  EbayCampaignStatus,
  type EbayCampaignDto,
} from '@repo/shared';
import { lightTheme, ToastContext } from '@repo/ui';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { baseApi } from '../../../api/baseApi';
import { ActiveStoreContext } from '../../ebay/hooks/useActiveStore';
import { campaignsApi } from '../api/campaigns.api';

import { CampaignsPageContainer } from './CampaignsPage.container';

import i18n from '@/i18n.config';

vi.mock('../../../components/EbayAccountGuard', () => ({
  EbayAccountGuard: ({ children }: { children: ReactNode }) => children,
}));
const server = setupServer();
const success = vi.fn();
const error = vi.fn();
const completed = vi.fn();
let store: ReturnType<typeof makeStore>;
function makeStore() {
  const listener = createListenerMiddleware();
  listener.startListening({
    matcher: isAnyOf(
      campaignsApi.endpoints.createCampaign.matchFulfilled,
      campaignsApi.endpoints.createCampaign.matchRejected
    ),
    effect: () => {
      completed();
    },
  });
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(listener.middleware, baseApi.middleware),
  });
}
function campaign(overrides: Partial<EbayCampaignDto> = {}): EbayCampaignDto {
  return {
    id: '1',
    ebayAccountId: 'store-a',
    campaignId: '123',
    name: 'Summer campaign',
    status: EbayCampaignStatus.RUNNING,
    fundingModel: EbayCampaignFundingModel.COST_PER_SALE,
    adRateStrategy: EbayAdRateStrategy.FIXED,
    bidPercentage: 5,
    ruleBased: false,
    createdBySellerHill: true,
    startDate: null,
    endDate: null,
    adCount: null,
    sellerHillListingCount: 3,
    readOnlyReason: null,
    syncedAt: '',
    metrics: null,
    metricsFrom: null,
    metricsTo: null,
    ...overrides,
  };
}
function list(items = [campaign()], status: string | null = 'ELIGIBLE', reason: string | null = null) {
  server.use(http.get('*/campaigns', () => HttpResponse.json({ campaigns: items, eligibility: { status, reason } })));
}
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function mount(initialStore: string | null = 'store-a', stores: EbayAccountPublicDto[] = []) {
  let activeStoreId = initialStore;
  const tree = () => (
    <Provider store={store}>
      <ThemeProvider theme={lightTheme}>
        <ToastContext.Provider value={{ toast: { success, error, info: vi.fn(), warning: vi.fn() } }}>
          <ActiveStoreContext.Provider value={{ activeStoreId, stores, setActiveStore: () => undefined }}>
            <MemoryRouter>
              <CampaignsPageContainer />
            </MemoryRouter>
          </ActiveStoreContext.Provider>
        </ToastContext.Provider>
      </ThemeProvider>
    </Provider>
  );
  const view = render(tree());
  return {
    ...view,
    switchStore: (id: string | null) => {
      activeStoreId = id;
      view.rerender(tree());
    },
  };
}
async function openAndFill() {
  fireEvent.click(await screen.findByRole('button', { name: 'Create campaign' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Campaign name' }), {
    target: { value: 'New campaign' },
  });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ad rate (%)' }), { target: { value: '5.1' } });
  return dialog;
}
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(async () => {
  store = makeStore();
  success.mockClear();
  error.mockClear();
  completed.mockClear();
  await i18n.changeLanguage('en');
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  store.dispatch(baseApi.util.resetApiState());
});
afterAll(() => server.close());

describe('campaign list and create', () => {
  it('shows loading then empty using the page empty surface', async () => {
    const pending = deferred();
    server.use(
      http.get('*/campaigns', async () => {
        await pending.promise;
        return HttpResponse.json({ campaigns: [], eligibility: { status: 'ELIGIBLE', reason: null } });
      })
    );
    mount();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    await screen.findByText('No campaigns yet');
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeEnabled();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });
  it('skips reads without store context', async () => {
    const reads = vi.fn();
    server.use(
      http.get('*/campaigns', () => {
        reads();
        return HttpResponse.json({ campaigns: [] });
      })
    );
    mount(null);
    await screen.findByText('Select an eBay store in the top bar.');
    expect(reads).not.toHaveBeenCalled();
  });
  it('keeps null eligibility unavailable and create disabled', async () => {
    list([campaign()], null);
    mount();
    await screen.findByText('Summer campaign');
    expect(
      screen.getByText('We could not check whether this store can advertise, so you cannot create campaigns right now.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled();
    // Unknown figures are an em dash (never 0), and the hero says they wait for eBay's report.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(9);
    expect(screen.getByText(/waiting for eBay's reports/)).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    expect(screen.queryByText('0×')).not.toBeInTheDocument();
  });
  it('shows server ineligibility reason while keeping read-only campaigns readable in cards and table', async () => {
    list(
      [campaign({ readOnlyReason: CampaignReadOnlyReason.RULE_BASED, ruleBased: true, createdBySellerHill: false })],
      'INELIGIBLE',
      'NOT_ENOUGH_ACTIVITY'
    );
    mount();
    await screen.findByText('Summer campaign');
    expect(screen.getByText('Advertising is unavailable for this store.')).toBeInTheDocument();
    expect(screen.getByText('Read-only campaign')).toBeInTheDocument();
    expect(screen.getByText('Created outside SellerHill')).toBeInTheDocument();
    // The whole card opens the campaign.
    expect(screen.getByRole('button', { name: 'Summer campaign' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /table/i }));
    // In the table the row opens it.
    expect(screen.getByText('Summer campaign').closest('tr')).not.toBeNull();
    expect(screen.getByText('Created outside SellerHill')).toBeInTheDocument();
  });
  it('filters by status tab and search, with counts on the tabs', async () => {
    list([
      campaign(),
      campaign({ id: '2', campaignId: '456', name: 'Winter clearance', status: EbayCampaignStatus.PAUSED }),
    ]);
    mount();
    await screen.findByText('Summer campaign');
    fireEvent.click(screen.getByRole('tab', { name: /Paused/ }));
    expect(screen.queryByText('Summer campaign')).not.toBeInTheDocument();
    expect(screen.getByText('Winter clearance')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /All/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search by campaign name or ID' }), {
      target: { value: 'summer' },
    });
    expect(screen.getByText('Summer campaign')).toBeInTheDocument();
    expect(screen.queryByText('Winter clearance')).not.toBeInTheDocument();
  });
  it('validates on click, preserves the form, and sends the active store with valid input', async () => {
    list([]);
    const writes: unknown[] = [];
    server.use(
      http.post('*/campaigns', async ({ request }) => {
        writes.push(await request.json());
        return HttpResponse.json(campaign());
      })
    );
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Create campaign' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Create campaign' });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(within(dialog).getByText('Enter a campaign name of 1–80 characters.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Enter an ad rate from 2.0% to 100.0%, with at most one decimal.')
    ).toBeInTheDocument();
    expect(writes).toEqual([]);
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Campaign name' }), {
      target: { value: '  New campaign  ' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ad rate (%)' }), { target: { value: '5.11' } });
    fireEvent.click(submit);
    expect(writes).toEqual([]);
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ad rate (%)' }), { target: { value: '5.1' } });
    fireEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toEqual([{ ebayAccountId: 'store-a', name: 'New campaign', bidPercentage: 5.1 }]);
    expect(success).toHaveBeenCalledWith('Campaign created.');
  });
  it('formats currency from the active marketplace independently of user language', async () => {
    list([campaign({ metrics: { sales: 1234.5, adFees: 10, clicks: 0 } })]);
    await i18n.changeLanguage('de');
    mount('store-a', [
      {
        id: 'store-a',
        marketplaceId: EbayMarketplaceId.EBAY_UK,
        userId: 'u',
        sellerId: 's',
        status: EbayAccountStatus.ACTIVE,
        messagingEnabled: false,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    await screen.findByText('Summer campaign');
    expect(screen.getAllByText(/1\.234,50\s£/)).toHaveLength(2);
    expect(screen.queryByText('$1,234.50')).not.toBeInTheDocument();
  });
  it.each([
    ['x'.repeat(81), '5'],
    ['Name', '1.9'],
    ['Name', '100.1'],
    ['Name', '2.01'],
  ])('rejects invalid boundary input %s / %s before sending', async (name, rate) => {
    list([]);
    const writes = vi.fn();
    server.use(
      http.post('*/campaigns', () => {
        writes();
        return HttpResponse.json(campaign());
      })
    );
    mount();
    const dialog = await openAndFill();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Campaign name' }), { target: { value: name } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ad rate (%)' }), { target: { value: rate } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create campaign' }));
    expect(within(dialog).getAllByRole('alert').length).toBeGreaterThan(0);
    expect(writes).not.toHaveBeenCalled();
  });
  it.each([
    'storeUnavailable',
    'suspended',
    'notFound',
    'ineligible',
    'readOnly',
    'invalidRate',
    'ebayRejected',
    'invalidName',
    'nameTaken',
  ])('localizes server error %s', async (key) => {
    list([]);
    server.use(
      http.post('*/campaigns', () => HttpResponse.json({ message: `campaigns.errors.${key}` }, { status: 409 }))
    );
    mount();
    const dialog = await openAndFill();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create campaign' }));
    await within(dialog).findByText(i18n.t(`campaigns:campaigns.errors.${key}`));
    expect(success).not.toHaveBeenCalled();
  });
  it.each([true, false])('ignores old-store %s completion including after A → B → A', async (succeeded) => {
    list([]);
    const pending = deferred();
    server.use(
      http.post('*/campaigns', async () => {
        await pending.promise;
        return succeeded
          ? HttpResponse.json(campaign())
          : HttpResponse.json({ message: 'campaigns.errors.nameTaken' }, { status: 409 });
      })
    );
    const view = mount();
    const dialog = await openAndFill();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create campaign' }));
    await waitFor(() =>
      expect(
        Object.values(store.getState()[baseApi.reducerPath].mutations).some(
          (entry) => entry?.status === QueryStatus.pending
        )
      ).toBe(true)
    );
    view.switchStore('store-b');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await screen.findByText('No campaigns yet');
    view.switchStore('store-a');
    fireEvent.click(await screen.findByRole('button', { name: 'Create campaign' }));
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Campaign name' })).toHaveValue('');
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('A campaign with this name already exists.')).not.toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
  it('ignores completion after closing and reopening the same-store drawer', async () => {
    list([]);
    const pending = deferred();
    server.use(
      http.post('*/campaigns', async () => {
        await pending.promise;
        return HttpResponse.json(campaign());
      })
    );
    mount();
    const dialog = await openAndFill();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create campaign' }));
    await waitFor(() =>
      expect(
        Object.values(store.getState()[baseApi.reducerPath].mutations).some(
          (entry) => entry?.status === QueryStatus.pending
        )
      ).toBe(true)
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close drawer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
  });
});
