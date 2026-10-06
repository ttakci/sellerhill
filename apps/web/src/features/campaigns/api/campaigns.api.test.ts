import { configureStore } from '@reduxjs/toolkit';
import { CampaignAction } from '@repo/shared';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';

import { baseApi } from '../../../api/baseApi';

import { campaignsApi } from './campaigns.api';

const server = setupServer();
const store = configureStore({
  reducer: { [baseApi.reducerPath]: baseApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  store.dispatch(baseApi.util.resetApiState());
});
afterAll(() => server.close());

it('keys campaign list reads by store and preserves null metrics', async () => {
  const accounts: string[] = [];
  server.use(http.get('*/campaigns', ({ request }) => {
    const id = new URL(request.url).searchParams.get('ebayAccountId');
    accounts.push(id ?? '');
    return HttpResponse.json({ campaigns: [{ campaignId: id, metrics: null }], eligibility: {} });
  }));

  const first = await store.dispatch(campaignsApi.endpoints.getCampaigns.initiate({ ebayAccountId: 'store-a' }));
  const second = await store.dispatch(campaignsApi.endpoints.getCampaigns.initiate({ ebayAccountId: 'store-b' }));

  expect(accounts).toEqual(['store-a', 'store-b']);
  expect(first.data?.campaigns[0]?.metrics).toBeNull();
  expect(second.data?.campaigns[0]?.campaignId).toBe('store-b');
});

it('sends the store in campaign writes', async () => {
  let received: unknown;
  server.use(http.post('*/campaigns', async ({ request }) => {
    received = await request.json();
    return HttpResponse.json({ campaignId: '123' });
  }));

  await store.dispatch(campaignsApi.endpoints.createCampaign.initiate({
    ebayAccountId: 'store-a', name: 'Spring', bidPercentage: 5,
  }));
  expect(received).toEqual({ ebayAccountId: 'store-a', name: 'Spring', bidPercentage: 5 });
});

it('sends the store and filters in detail and candidates reads', async () => {
  const requested: string[] = [];
  server.use(
    http.get('*/campaigns/123', ({ request }) => {
      requested.push(request.url);
      return HttpResponse.json({ campaign: {}, listings: [], eligibility: {} });
    }),
    http.get('*/campaigns/candidates', ({ request }) => {
      requested.push(request.url);
      return HttpResponse.json({ items: [], total: 0, page: 2, limit: 10, skippedInCampaign: 0 });
    })
  );
  await store.dispatch(campaignsApi.endpoints.getCampaign.initiate({ ebayAccountId: 'store-a', campaignId: '123' }));
  await store.dispatch(campaignsApi.endpoints.getCampaignCandidates.initiate({
    ebayAccountId: 'store-a', listingSettingsGroupId: 'group-a', search: 'shirt', page: 2, limit: 10,
  }));
  expect(new URL(requested[0]).searchParams.get('ebayAccountId')).toBe('store-a');
  expect(Object.fromEntries(new URL(requested[1]).searchParams)).toEqual({
    ebayAccountId: 'store-a', listingSettingsGroupId: 'group-a', search: 'shirt', page: '2', limit: '10',
  });
});

it('uses the controller write paths and includes the store in every body', async () => {
  const requests: Array<{ path: string; body: unknown }> = [];
  server.use(http.post('*/campaigns/123/*', async ({ request }) => {
    requests.push({ path: new URL(request.url).pathname, body: await request.json() });
    return HttpResponse.json({ campaignId: '123', results: [] });
  }));
  const scope = { ebayAccountId: 'store-a', campaignId: '123' };
  await store.dispatch(campaignsApi.endpoints.addCampaignListings.initiate({ ...scope, listingIds: ['one'] }));
  await store.dispatch(campaignsApi.endpoints.removeCampaignListings.initiate({ ...scope, listingIds: ['one'] }));
  await store.dispatch(campaignsApi.endpoints.changeCampaignRate.initiate({ ...scope, bidPercentage: 7, listingIds: ['one'] }));
  await store.dispatch(campaignsApi.endpoints.performCampaignAction.initiate({ ...scope, action: CampaignAction.PAUSE }));
  expect(requests.map(({ path }) => path)).toEqual([
    '/api/v1/campaigns/123/listings/add', '/api/v1/campaigns/123/listings/remove',
    '/api/v1/campaigns/123/rate', '/api/v1/campaigns/123/actions/pause',
  ]);
  expect(requests.map(({ body }) => body)).toEqual([
    { ebayAccountId: 'store-a', listingIds: ['one'] },
    { ebayAccountId: 'store-a', listingIds: ['one'] },
    { ebayAccountId: 'store-a', bidPercentage: 7, listingIds: ['one'] },
    { ebayAccountId: 'store-a' },
  ]);
});
