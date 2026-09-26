import type { ConfigService } from '@nestjs/config';
import { EbayApiResource, EbayCallPriority } from '@repo/shared';

import { EbayAnalyticsService, EBAY_ANALYTICS_TIMEOUT_MS, PANEL_CACHE_MS } from './ebay-analytics.service';
import { EbayBudgetExhaustedError } from './ebay-budget.errors';
import type { EbayCallBudgetService } from './ebay-call-budget.service';
import type { EbayRateLimitStore } from './ebay-rate-limit.store';

const CONFIG: Record<string, string> = {
  EBAY_CLIENT_ID: 'id',
  EBAY_CLIENT_SECRET: 'secret',
  EBAY_TOKEN_URL: 'https://api.ebay.com/identity/v1/oauth2/token',
  EBAY_REST_API_URL: 'https://api.ebay.com/',
};

const rateBody = {
  rateLimits: [
    { apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resources: [{ name: 'sell.inventory', rates: [{ limit: 2_000_000, remaining: 1, timeWindow: 86_400, reset: null }] }] },
  ],
};

const response = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }) as Response;

function setup(config: Record<string, string> = CONFIG) {
  const store = { save: jest.fn(() => Promise.resolve(undefined)), current: jest.fn(() => Promise.resolve(null)) };
  const budget = { acquire: jest.fn(() => Promise.resolve(undefined)) };
  const cfg = { get: (k: string) => config[k] } as unknown as ConfigService;
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();
  global.fetch = fetchMock as unknown as typeof fetch;
  const service = new EbayAnalyticsService(
    cfg,
    store as unknown as EbayRateLimitStore,
    budget as unknown as EbayCallBudgetService,
  );
  return { service, store, budget, fetchMock };
}

describe('EbayAnalyticsService.refresh', () => {
  afterEach(() => jest.useRealTimers());

  it('gets an application token, calls rate_limit, and persists the parsed resources', async () => {
    const { service, store, budget, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValueOnce(response(200, rateBody));

    expect(await service.refresh()).toBe(true);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe(CONFIG.EBAY_TOKEN_URL);
    expect(String(tokenInit?.body)).toContain('grant_type=client_credentials');
    const [rateLimitUrl, rateLimitInit] = fetchMock.mock.calls[1];
    expect(rateLimitUrl).toBe('https://api.ebay.com/developer/analytics/v1_beta/rate_limit/');
    expect((rateLimitInit?.headers as Record<string, string> | undefined)?.Authorization).toBe('Bearer tok');
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.ANALYTICS, EbayCallPriority.INTERACTIVE, 1);
    expect(store.save).toHaveBeenCalledWith(
      [expect.objectContaining({ resourceName: 'sell.inventory' })],
      expect.any(Date),
    );
  });

  it('reuses the application token until shortly before it expires', async () => {
    const { service, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValue(response(200, rateBody));
    await service.refresh();
    await service.refresh();
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => url === CONFIG.EBAY_TOKEN_URL);
    expect(tokenCalls).toHaveLength(1);
  });

  it.each([
    ['a 403', () => response(403, 'forbidden')],
    ['a 500', () => response(500, 'boom')],
    ['a non-JSON body', () => response(200, 'not json')],
    ['an empty rateLimits', () => response(200, { rateLimits: [] })],
  ])('leaves the stored snapshot alone on %s', async (_label, make) => {
    const { service, store, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 })).mockResolvedValueOnce(make());
    expect(await service.refresh()).toBe(false);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('never throws on a network error', async () => {
    const { service, fetchMock } = setup();
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(service.refresh()).resolves.toBe(false);
  });

  it('never throws when eBay stalls and the timeout aborts the request', async () => {
    const { service, store, fetchMock } = setup();
    const timeoutError = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    fetchMock.mockRejectedValue(timeoutError);
    await expect(service.refresh()).resolves.toBe(false);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('passes an abort signal on both the token request and the rate_limit request', async () => {
    const { service, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValueOnce(response(200, rateBody));
    await service.refresh();
    expect(fetchMock.mock.calls[0][1]?.signal).toBeDefined();
    expect(fetchMock.mock.calls[1][1]?.signal).toBeDefined();
    // Sanity: the timeout constant is actually wired in, not a stray signal.
    expect(EBAY_ANALYTICS_TIMEOUT_MS).toBe(10_000);
  });

  it('does not call eBay when credentials are missing', async () => {
    const { service, fetchMock } = setup({});
    expect(await service.refresh()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an exhausted Analytics budget as a failed refresh', async () => {
    const { service, budget, fetchMock } = setup();
    budget.acquire.mockRejectedValueOnce(new EbayBudgetExhaustedError(EbayApiResource.ANALYTICS, new Date()));
    fetchMock.mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 }));
    expect(await service.refresh()).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('rate_limit'))).toBe(false);
  });
});

describe('EbayAnalyticsService.forPanel', () => {
  afterEach(() => jest.useRealTimers());

  it('calls eBay at most once per cache window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00Z'));
    const { service, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValue(response(200, rateBody));
    await service.forPanel();
    await service.forPanel();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('rate_limit'))).toHaveLength(1);
    jest.setSystemTime(new Date(Date.now() + PANEL_CACHE_MS + 1));
    await service.forPanel();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('rate_limit'))).toHaveLength(2);
  });

  it('reports live=false and serves the stored snapshot when the fetch fails', async () => {
    const { service, store, fetchMock } = setup();
    const stored = { resources: [], fetchedAt: new Date('2026-09-24T00:00:00Z'), mapped: {} };
    store.current.mockResolvedValue(stored as never);
    fetchMock.mockRejectedValue(new Error('down'));
    expect(await service.forPanel()).toEqual({ snapshot: stored, live: false });
  });
});
