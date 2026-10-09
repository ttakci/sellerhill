import { ThemeProvider } from '@emotion/react';
import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';
import {
  CampaignAddOutcome,
  CampaignReadOnlyReason,
  EbayAdRateStrategy,
  EbayAccountStatus,
  EbayMarketplaceId,
  EbayCampaignFundingModel,
  EbayCampaignStatus,
  type CampaignListingDto,
  type EbayCampaignDto,
  type EbayAccountPublicDto,
} from '@repo/shared';
import { lightTheme, ToastContext } from '@repo/ui';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useLayoutEffect, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { baseApi } from '../../../api/baseApi';
import { ActiveStoreContext } from '../../ebay/hooks/useActiveStore';
import { campaignsApi } from '../api/campaigns.api';

import { CampaignDetailPageContainer } from './CampaignDetailPage.container';

import i18n from '@/i18n.config';

vi.mock('../../../components/EbayAccountGuard', () => ({
  EbayAccountGuard: ({ children }: { children: ReactNode }) => children,
}));
const server = setupServer();
const success = vi.fn();
const error = vi.fn();
const completed = vi.fn();
let store: ReturnType<typeof makeStore>;
let navigate: NavigateFunction;
function makeStore() {
  const listener = createListenerMiddleware();
  listener.startListening({
    matcher: isAnyOf(
      ...[
        campaignsApi.endpoints.addCampaignListings,
        campaignsApi.endpoints.removeCampaignListings,
        campaignsApi.endpoints.changeCampaignRate,
        campaignsApi.endpoints.performCampaignAction,
      ].flatMap((endpoint) => [endpoint.matchFulfilled, endpoint.matchRejected])
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
    sellerHillListingCount: 2,
    readOnlyReason: null,
    syncedAt: '',
    metrics: null,
    metricsFrom: null,
    metricsTo: null,
    ...overrides,
  };
}
function member(listingId: string, overrides: Partial<CampaignListingDto> = {}): CampaignListingDto {
  return {
    listingId,
    ebayItemId: 'ebay-' + listingId,
    title: listingId,
    imageUrl: null,
    price: 10,
    adRate: 5,
    appliedAdRate: 5,
    priceLocked: false,
    hasMarginOverride: false,
    ...overrides,
  };
}
function reads(
  items = [member('one'), member('two')],
  overrides: Partial<EbayCampaignDto> = {},
  status: string | null = 'ELIGIBLE',
  reason: string | null = null
) {
  server.use(
    http.get('*/listing-settings-group/groups', () =>
      HttpResponse.json([
        { id: 'group-a', name: 'Group A' },
        { id: 'group-b', name: 'Group B' },
      ])
    ),
    http.get('*/campaigns/candidates', ({ request }) => {
      const params = new URL(request.url).searchParams;
      return HttpResponse.json({
        items: [member('candidate')],
        page: Number(params.get('page')),
        limit: Number(params.get('limit')),
        total: 1,
        skippedInCampaign: 3,
      });
    }),
    http.get('*/campaigns/:campaignId', ({ request, params }) =>
      HttpResponse.json({
        campaign: campaign({
          campaignId: String(params.campaignId),
          name: `${new URL(request.url).searchParams.get('ebayAccountId')} / ${String(params.campaignId)}`,
          ...overrides,
        }),
        listings: items,
        eligibility: { status, reason },
      })
    )
  );
}
function Harness() {
  const routerNavigate = useNavigate();
  useLayoutEffect(() => {
    navigate = routerNavigate;
  }, [routerNavigate]);
  return (
    <Routes>
      <Route path="/:locale/campaigns/:campaignId" element={<CampaignDetailPageContainer />} />
    </Routes>
  );
}
function mount(initialStore: string | null = 'store-a', stores: EbayAccountPublicDto[] = []) {
  let activeStoreId = initialStore;
  const tree = () => (
    <Provider store={store}>
      <ThemeProvider theme={lightTheme}>
        <ToastContext.Provider value={{ toast: { success, error, info: vi.fn(), warning: vi.fn() } }}>
          <ActiveStoreContext.Provider value={{ activeStoreId, stores, setActiveStore: () => undefined }}>
            <MemoryRouter initialEntries={['/en/campaigns/123']}>
              <Harness />
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
    route: (id: string) =>
      act(() => {
        void navigate(`/en/campaigns/${id}`);
      }),
  };
}
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitPending() {
  await waitFor(() =>
    expect(
      Object.values(store.getState()[baseApi.reducerPath].mutations).some(
        (entry) => entry?.status === QueryStatus.pending
      )
    ).toBe(true)
  );
}
async function release(pending: ReturnType<typeof deferred>) {
  await act(async () => {
    pending.resolve();
    await pending.promise;
  });
  await waitFor(() => expect(completed).toHaveBeenCalled());
}
async function openAdd() {
  fireEvent.click(await screen.findByRole('button', { name: 'Add listings' }));
  const dialog = screen.getByRole('dialog');
  await within(dialog).findByRole('checkbox', { name: 'candidate' });
  return dialog;
}
async function openRate(name = 'Change default ad rate') {
  fireEvent.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog');
}
function selectGroup(name: string) {
  fireEvent.click(screen.getByText('Settings group'));
  fireEvent.click(screen.getByText(name));
}
function selectMember(name: string) {
  const row = screen.getByText(name).closest('tr');
  if (!row) {
    throw new Error('Missing member row');
  }
  fireEvent.click(within(row).getByRole('checkbox'));
}
function endConfirmation() {
  const confirmation = screen.getByText('End this campaign? It cannot be resumed.').parentElement?.parentElement;
  if (!confirmation) {
    throw new Error('Missing confirmation');
  }
  return confirmation;
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

describe('campaign detail and writes', () => {
  it('skips every store-scoped read without a store and clears old data while a new store loads', async () => {
    reads();
    const view = mount(null);
    expect(screen.getByText('Select an eBay store in the top bar.')).toBeInTheDocument();
    expect(Object.keys(store.getState()[baseApi.reducerPath].queries)).toHaveLength(0);
    view.switchStore('store-a');
    await screen.findByText('store-a / 123');
    const pending = deferred();
    server.use(
      http.get('*/campaigns/123', async () => {
        await pending.promise;
        return HttpResponse.json({
          campaign: campaign({ name: 'New store' }),
          listings: [],
          eligibility: { status: 'ELIGIBLE', reason: null },
        });
      })
    );
    view.switchStore('store-b');
    expect(screen.queryByText('one')).not.toBeInTheDocument();
    expect(screen.queryByText('store-a / 123')).not.toBeInTheDocument();
    pending.resolve();
    await screen.findByText('New store');
  });
  it('shows synced 5% despite margin exclusion and keeps margin members editable', async () => {
    reads([member('margin', { hasMarginOverride: true, appliedAdRate: 5 }), member('locked', { priceLocked: true })]);
    const bodies: unknown[] = [];
    server.use(
      http.post('*/campaigns/123/rate', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ results: [{ listingId: 'margin', outcome: CampaignAddOutcome.ADDED }] });
      })
    );
    mount();
    await screen.findByText('Margin override: ad rate is not applied to the SellerHill price.');
    const marginRow = screen.getByText('margin').closest('tr');
    if (!marginRow) {
      throw new Error('Missing margin member');
    }
    expect(within(marginRow).getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('Price locked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove: margin' })).toBeEnabled();
    const dialog = await openRate('Edit rate: margin');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ad rate (%)' }), { target: { value: '6.2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(success).toHaveBeenCalledWith('Ad rate updated.'));
    expect(bodies).toEqual([{ ebayAccountId: 'store-a', bidPercentage: 6.2, listingIds: ['margin'] }]);
  });
  it.each(Object.values(CampaignReadOnlyReason))(
    'keeps %s readable with all writes disabled',
    async (readOnlyReason) => {
      reads([member('one')], { readOnlyReason });
      mount();
      await screen.findByText('one');
      expect(screen.getByRole('button', { name: 'Add listings' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Edit rate: one' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'End campaign' })).toBeDisabled();
      expect(screen.getByText(i18n.t(`campaigns:campaigns.readOnly.${readOnlyReason}`))).toBeInTheDocument();
    }
  );
  it.each([null, 'INELIGIBLE'])('shows eligibility %s reason and disables writes', async (status) => {
    reads(undefined, {}, status, 'NOT_ENOUGH_ACTIVITY');
    mount();
    await screen.findByText('one');
    expect(screen.getByRole('button', { name: 'Add listings' })).toBeDisabled();
    expect(
      screen.getByText(
        status ? 'Advertising is unavailable for this store.' : 'Advertising eligibility is unavailable. Campaign changes are disabled.'
      )
    ).toBeInTheDocument();
  });
  it('formats honest zero and unavailable metrics using marketplace currency and user locale', async () => {
    reads([], { metrics: { clicks: 0, sales: 1234.5, adFees: Number.NaN }, adCount: 0 });
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
    await screen.findByText(/1\.234,50\s£/);
    // Unknown figures are an em dash (never 0); a missing fact keeps its words.
    expect(screen.getAllByText('—').length).toBeGreaterThan(3);
    expect(screen.getAllByText('Nicht verfügbar').length).toBeGreaterThan(0);
    expect(screen.queryByText('0,00 £')).not.toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBe(2);
  });
  it('retains failed add rows for retry and distinguishes already present rows', async () => {
    reads();
    server.use(
      http.get('*/campaigns/candidates', () =>
        HttpResponse.json({
          items: [member('new'), member('already'), member('failed')],
          total: 3,
          page: 1,
          limit: 25,
          skippedInCampaign: 8,
        })
      )
    );
    const bodies: unknown[] = [];
    server.use(
      http.post('*/campaigns/123/listings/add', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          results:
            bodies.length === 1
              ? [
                  { listingId: 'new', outcome: CampaignAddOutcome.ADDED },
                  { listingId: 'already', outcome: CampaignAddOutcome.ALREADY_IN_CAMPAIGN },
                  { listingId: 'failed', outcome: CampaignAddOutcome.FAILED },
                ]
              : [{ listingId: 'failed', outcome: CampaignAddOutcome.ADDED }],
        });
      })
    );
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Add listings' }));
    const dialog = screen.getByRole('dialog');
    for (const name of ['new', 'already', 'failed']) {
      fireEvent.click(await within(dialog).findByRole('checkbox', { name }));
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add listings' }));
    await within(dialog).findByText('Confirmed changes: 1. Already in campaign: 1. Unconfirmed or failed: 1.');
    expect(within(dialog).getByRole('button', { name: 'Deselect: failed' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Deselect: new' })).not.toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add listings' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([
      { ebayAccountId: 'store-a', listingIds: ['new', 'already', 'failed'] },
      { ebayAccountId: 'store-a', listingIds: ['failed'] },
    ]);
  });
  it('preserves selection on empty add outcomes and reports the lack of confirmation', async () => {
    reads();
    server.use(http.post('*/campaigns/123/listings/add', () => HttpResponse.json({ results: [] })));
    mount();
    const dialog = await openAdd();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'candidate' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add listings' }));
    await within(dialog).findByText('Confirmed changes: 0. Already in campaign: 0. Unconfirmed or failed: 1.');
    expect(within(dialog).getByRole('button', { name: 'Deselect: candidate' })).toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
  });
  it('keeps failed removals selected for retry and uses ADDED as confirmed removal', async () => {
    reads();
    const bodies: unknown[] = [];
    server.use(
      http.post('*/campaigns/123/listings/remove', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          results:
            bodies.length === 1
              ? [
                  { listingId: 'one', outcome: CampaignAddOutcome.ADDED },
                  { listingId: 'two', outcome: CampaignAddOutcome.FAILED },
                ]
              : [{ listingId: 'two', outcome: CampaignAddOutcome.ADDED }],
        });
      })
    );
    mount();
    await screen.findByText('one');
    selectMember('one');
    selectMember('two');
    fireEvent.click(screen.getByRole('button', { name: 'Remove listings' }));
    await screen.findByText('Confirmed changes: 1. Already in campaign: 0. Unconfirmed or failed: 1.');
    const row = screen.getByText('two').closest('tr');
    expect(row && within(row).getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Remove listings' }));
    await waitFor(() => expect(success).toHaveBeenCalledWith('Listings removed.'));
    expect(bodies).toEqual([
      { ebayAccountId: 'store-a', listingIds: ['one', 'two'] },
      { ebayAccountId: 'store-a', listingIds: ['two'] },
    ]);
  });
  it('omits listingIds for default rate and retries only failed members', async () => {
    reads();
    const bodies: unknown[] = [];
    server.use(
      http.post('*/campaigns/123/rate', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          results:
            bodies.length === 1
              ? [
                  { listingId: 'one', outcome: CampaignAddOutcome.ADDED },
                  { listingId: 'two', outcome: CampaignAddOutcome.FAILED },
                ]
              : [{ listingId: 'two', outcome: CampaignAddOutcome.ADDED }],
        });
      })
    );
    mount();
    const dialog = await openRate();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ad rate (%)' }), { target: { value: '7' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await within(dialog).findByText('two');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry failed members' }));
    await waitFor(() => expect(success).toHaveBeenCalledWith('Ad rate updated.'));
    expect(bodies).toEqual([
      { ebayAccountId: 'store-a', bidPercentage: 7 },
      { ebayAccountId: 'store-a', bidPercentage: 7, listingIds: ['two'] },
    ]);
  });
  it('treats a resolved default rate response without member updates as success', async () => {
    reads([]);
    server.use(http.post('*/campaigns/123/rate', () => HttpResponse.json({ results: [] })));
    mount();
    const dialog = await openRate();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(success).toHaveBeenCalledWith('Ad rate updated.'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('validates rate on submit and retains localized server refusal', async () => {
    reads();
    const writes = vi.fn();
    server.use(
      http.post('*/campaigns/123/rate', () => {
        writes();
        return HttpResponse.json({ message: 'campaigns.errors.ebayRejected' }, { status: 409 });
      })
    );
    mount();
    const dialog = await openRate();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ad rate (%)' }), { target: { value: '5.11' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter an ad rate');
    expect(writes).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ad rate (%)' }), { target: { value: '6' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await within(dialog).findByText('eBay could not complete this action. Try again.');
    expect(success).not.toHaveBeenCalled();
  });
  it('fills all group pages at limit 100 once, reports skipped count and allows deselection', async () => {
    reads();
    const pages: number[] = [];
    server.use(
      http.get('*/campaigns/candidates', ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get('limit') !== '100') {
          return HttpResponse.json({
            items: [member('candidate')],
            total: 1,
            page: 1,
            limit: 25,
            skippedInCampaign: 0,
          });
        }
        const page = Number(params.get('page'));
        pages.push(page);
        return HttpResponse.json({
          items:
            page === 1 ? Array.from({ length: 100 }, (_, index) => member(`group-${index}`)) : [member('group-100')],
          total: 101,
          page,
          limit: 100,
          skippedInCampaign: 7,
        });
      })
    );
    mount();
    const dialog = await openAdd();
    selectGroup('Group A');
    await within(dialog).findByText('Selected listings: 101');
    expect(pages).toEqual([1, 2]);
    expect(within(dialog).getByText('Already in a campaign: 7')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deselect: group-100' }));
    expect(within(dialog).getByText('Selected listings: 100')).toBeInTheDocument();
    expect(pages).toEqual([1, 2]);
  });
  it('ignores stale group fill after a newer group selection and preserves selection on group failure', async () => {
    reads();
    const pending = deferred();
    const started = vi.fn();
    server.use(
      http.get('*/campaigns/candidates', async ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get('limit') !== '100') {
          return HttpResponse.json({
            items: [member('candidate')],
            total: 1,
            page: 1,
            limit: 25,
            skippedInCampaign: 0,
          });
        }
        if (params.get('listingSettingsGroupId') === 'group-a') {
          started();
          await pending.promise;
          return HttpResponse.json({ items: [member('stale')], total: 1, page: 1, limit: 100, skippedInCampaign: 9 });
        }
        return HttpResponse.json({ items: [member('newest')], total: 1, page: 1, limit: 100, skippedInCampaign: 2 });
      })
    );
    mount();
    const dialog = await openAdd();
    selectGroup('Group A');
    await waitFor(() => expect(started).toHaveBeenCalled());
    selectGroup('Group B');
    await within(dialog).findByRole('button', { name: 'Deselect: newest' });
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(within(dialog).queryByRole('button', { name: 'Deselect: stale' })).not.toBeInTheDocument();
    server.use(http.get('*/campaigns/candidates', () => HttpResponse.json({ message: 'failed' }, { status: 500 })));
    selectGroup('Group A');
    await within(dialog).findByText('The entire group could not be loaded. Your selection was kept.');
    expect(within(dialog).getByRole('button', { name: 'Deselect: newest' })).toBeInTheDocument();
  });
  it('sends pause/resume/end bodies and requires explicit end confirmation', async () => {
    reads();
    let status = EbayCampaignStatus.RUNNING;
    const actions: Array<{ action: string; body: unknown }> = [];
    server.use(
      http.get('*/campaigns/123', () =>
        HttpResponse.json({
          campaign: campaign({ status }),
          listings: [],
          eligibility: { status: 'ELIGIBLE', reason: null },
        })
      ),
      http.post('*/campaigns/123/actions/:action', async ({ request, params }) => {
        actions.push({ action: String(params.action), body: await request.json() });
        status =
          params.action === 'pause'
            ? EbayCampaignStatus.PAUSED
            : params.action === 'resume'
              ? EbayCampaignStatus.RUNNING
              : EbayCampaignStatus.ENDED;
        return HttpResponse.json(campaign({ status }));
      })
    );
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Pause campaign' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Resume campaign' }));
    await screen.findByRole('button', { name: 'Pause campaign' });
    fireEvent.click(screen.getByRole('button', { name: 'End campaign' }));
    expect(actions).toHaveLength(2);
    const dialog = endConfirmation();
    fireEvent.click(within(dialog).getByRole('button', { name: 'End campaign' }));
    await waitFor(() => expect(actions).toHaveLength(3));
    expect(actions).toEqual(
      ['pause', 'resume', 'end'].map((action) => ({ action, body: { ebayAccountId: 'store-a' } }))
    );
  });
  it.each([true, false])('ignores old-store add %s through A → B → A', async (succeeded) => {
    reads();
    const pending = deferred();
    server.use(
      http.post('*/campaigns/123/listings/add', async () => {
        await pending.promise;
        return succeeded
          ? HttpResponse.json({ results: [{ listingId: 'candidate', outcome: CampaignAddOutcome.ADDED }] })
          : HttpResponse.json({ message: 'campaigns.errors.ebayRejected' }, { status: 409 });
      })
    );
    const view = mount();
    const dialog = await openAdd();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'candidate' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add listings' }));
    await waitPending();
    view.switchStore('store-b');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await screen.findByText('store-b / 123');
    view.switchStore('store-a');
    await openAdd();
    await release(pending);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('eBay could not complete this action. Try again.')).not.toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
  it.each([true, false])('ignores rate %s after a same-store route change', async (succeeded) => {
    reads();
    const pending = deferred();
    server.use(
      http.post('*/campaigns/123/rate', async () => {
        await pending.promise;
        return succeeded
          ? HttpResponse.json({ results: [{ listingId: 'one', outcome: CampaignAddOutcome.ADDED }] })
          : HttpResponse.json({ message: 'campaigns.errors.ebayRejected' }, { status: 409 });
      })
    );
    const view = mount();
    const dialog = await openRate('Edit rate: one');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitPending();
    view.route('456');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await screen.findByText('store-a / 456');
    await openRate('Edit rate: one');
    await release(pending);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('eBay could not complete this action. Try again.')).not.toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
  it.each([true, false])('keeps the rate drawer open while saving and reports the %s outcome', async (succeeded) => {
    reads();
    const pending = deferred();
    server.use(
      http.post('*/campaigns/123/rate', async () => {
        await pending.promise;
        return succeeded
          ? HttpResponse.json({ results: [{ listingId: 'one', outcome: CampaignAddOutcome.ADDED }] })
          : HttpResponse.json({ message: 'campaigns.errors.ebayRejected' }, { status: 409 });
      })
    );
    mount();
    const dialog = await openRate('Edit rate: one');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitPending();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close drawer' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await release(pending);
    if (succeeded) {
      await waitFor(() => expect(success).toHaveBeenCalledWith('Ad rate updated.'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    } else {
      await within(dialog).findByText('eBay could not complete this action. Try again.');
      expect(success).not.toHaveBeenCalled();
    }
    expect(error).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'ignores pending lifecycle %s after store switch and keeps the new confirmation',
    async (succeeded) => {
      reads();
      const pending = deferred();
      server.use(
        http.post('*/campaigns/123/actions/end', async () => {
          await pending.promise;
          return succeeded
            ? HttpResponse.json(campaign({ status: EbayCampaignStatus.ENDED }))
            : HttpResponse.json({ message: 'campaigns.errors.ebayRejected' }, { status: 409 });
        })
      );
      const view = mount();
      fireEvent.click(await screen.findByRole('button', { name: 'End campaign' }));
      fireEvent.click(within(endConfirmation()).getByRole('button', { name: 'End campaign' }));
      await waitPending();
      view.switchStore('store-b');
      await screen.findByText('store-b / 123');
      fireEvent.click(screen.getByRole('button', { name: 'End campaign' }));
      await release(pending);
      expect(endConfirmation()).toBeInTheDocument();
      expect(success).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    }
  );

  it('keeps server read-only campaign types readable with the reason and no writes', async () => {
    // The server folds an unknown funding model into `readOnlyReason` (campaignReadOnlyReason).
    reads([member('one')], { fundingModel: null, readOnlyReason: CampaignReadOnlyReason.COST_PER_CLICK });
    mount();
    await screen.findByText('Cost-per-click campaigns are read-only.');
    expect(screen.getByRole('button', { name: 'Remove: one' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change default ad rate' })).toBeDisabled();
  });
  it('uses store-scoped search and pagination while preserving the current selection', async () => {
    reads();
    const requests: URLSearchParams[] = [];
    server.use(
      http.get('*/campaigns/candidates', ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        const page = Number(params.get('page'));
        return HttpResponse.json({
          items: [member(page === 1 ? 'candidate' : 'page-two')],
          total: 26,
          page,
          limit: 25,
          skippedInCampaign: 4,
        });
      })
    );
    mount();
    const dialog = await openAdd();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'candidate' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next page' }));
    await within(dialog).findByRole('checkbox', { name: 'page-two' });
    expect(within(dialog).getByRole('button', { name: 'Deselect: candidate' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Search listings' }), { target: { value: 'shirt' } });
    await waitFor(() =>
      expect(requests.some((params) => params.get('search') === 'shirt' && params.get('page') === '1')).toBe(true)
    );
    expect(requests.every((params) => params.get('ebayAccountId') === 'store-a')).toBe(true);
    expect(requests.some((params) => params.get('page') === '2')).toBe(true);
  });
  it('locks manual selection edits while a group fill is pending', async () => {
    reads();
    const pending = deferred();
    const started = vi.fn();
    server.use(
      http.get('*/campaigns/candidates', async ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get('limit') === '100') {
          started();
          await pending.promise;
          return HttpResponse.json({
            items: [member('late-group')],
            total: 1,
            page: 1,
            limit: 100,
            skippedInCampaign: 0,
          });
        }
        return HttpResponse.json({ items: [member('candidate')], total: 1, page: 1, limit: 25, skippedInCampaign: 0 });
      })
    );
    mount();
    const dialog = await openAdd();
    selectGroup('Group A');
    await waitFor(() => expect(started).toHaveBeenCalled());
    expect(await within(dialog).findByRole('checkbox', { name: 'candidate' })).toBeDisabled();
    expect(within(dialog).getByRole('textbox', { name: 'Search listings' })).toBeDisabled();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(await within(dialog).findByRole('button', { name: 'Deselect: late-group' })).toBeEnabled();
    expect(within(dialog).getByRole('checkbox', { name: 'candidate' })).toBeEnabled();
  });
  it('sends adds in chunks of 500 and keeps failed and unsent ids selected after a chunk error', async () => {
    reads();
    server.use(
      http.get('*/campaigns/candidates', ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get('limit') !== '100') {
          return HttpResponse.json({
            items: [member('candidate')],
            total: 1,
            page: 1,
            limit: 25,
            skippedInCampaign: 0,
          });
        }
        const page = Number(params.get('page'));
        return HttpResponse.json({
          items: Array.from({ length: page === 6 ? 1 : 100 }, (_, index) =>
            member(`group-${(page - 1) * 100 + index}`)
          ),
          total: 501,
          page,
          limit: 100,
          skippedInCampaign: 0,
        });
      })
    );
    const bodies: Array<{ listingIds: string[] }> = [];
    server.use(
      http.post('*/campaigns/123/listings/add', async ({ request }) => {
        const body = (await request.json()) as { listingIds: string[] };
        bodies.push(body);
        return bodies.length === 2
          ? HttpResponse.json({ message: 'campaigns.errors.ebayRejected' }, { status: 409 })
          : HttpResponse.json({
              results: body.listingIds.map((listingId) => ({ listingId, outcome: CampaignAddOutcome.ADDED })),
            });
      })
    );
    mount();
    const dialog = await openAdd();
    selectGroup('Group A');
    await within(dialog).findByText('Selected listings: 501');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add listings' }));
    await within(dialog).findByText('eBay could not complete this action. Try again.');
    expect(bodies.map((body) => body.listingIds.length)).toEqual([500, 1]);
    expect(within(dialog).getByText('Selected listings: 1')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Deselect: group-500' })).toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add listings' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies.map((body) => body.listingIds)).toEqual([
      Array.from({ length: 500 }, (_, index) => `group-${index}`),
      ['group-500'],
      ['group-500'],
    ]);
  }, 30000);
  it.each([true, false])(
    'ignores pending removal %s after A to B to A without clearing a newer selection',
    async (succeeded) => {
      reads();
      const pending = deferred();
      server.use(
        http.post('*/campaigns/123/listings/remove', async () => {
          await pending.promise;
          return succeeded
            ? HttpResponse.json({ results: [{ listingId: 'one', outcome: CampaignAddOutcome.ADDED }] })
            : HttpResponse.json({ message: 'campaigns.errors.ebayRejected' }, { status: 409 });
        })
      );
      const view = mount();
      await screen.findByText('one');
      selectMember('one');
      fireEvent.click(screen.getByRole('button', { name: 'Remove listings' }));
      await waitPending();
      view.switchStore('store-b');
      await screen.findByText('store-b / 123');
      view.switchStore('store-a');
      await screen.findByText('store-a / 123');
      selectMember('two');
      await release(pending);
      const row = screen.getByText('two').closest('tr');
      expect(row && within(row).getByRole('checkbox')).toBeChecked();
      expect(screen.queryByText('eBay could not complete this action. Try again.')).not.toBeInTheDocument();
      expect(success).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    }
  );
  it.each([true, false])('ignores lifecycle %s after same-store route departure and return', async (succeeded) => {
    reads();
    const pending = deferred();
    server.use(
      http.post('*/campaigns/123/actions/end', async () => {
        await pending.promise;
        return succeeded
          ? HttpResponse.json(campaign({ status: EbayCampaignStatus.ENDED }))
          : HttpResponse.json({ message: 'campaigns.errors.ebayRejected' }, { status: 409 });
      })
    );
    const view = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'End campaign' }));
    fireEvent.click(within(endConfirmation()).getByRole('button', { name: 'End campaign' }));
    await waitPending();
    expect(within(endConfirmation()).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    view.route('456');
    await screen.findByText('store-a / 456');
    view.route('123');
    await screen.findByText('store-a / 123');
    fireEvent.click(screen.getByRole('button', { name: 'End campaign' }));
    await release(pending);
    expect(endConfirmation()).toBeInTheDocument();
    expect(screen.queryByText('eBay could not complete this action. Try again.')).not.toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
