// apps/api/src/modules/ebay-returns/post-order.client.spec.ts

import { EbayApiResource, EbayCallPriority } from '@repo/shared';

import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';

import { PostOrderClient, PostOrderResponseError } from './post-order.client';

const mockGet = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

interface RequestConfig {
  headers: Record<string, string>;
  params: Record<string, unknown>;
  timeout: number;
}

const FROM = '2026-07-02T09:00:00.000Z';

describe('PostOrderClient.searchReturns', () => {
  const budget = { acquire: jest.fn<Promise<void>, unknown[]>() };
  const config = {
    get: jest.fn((key: string) => (key === 'EBAY_REST_API_URL' ? 'https://api.ebay.com' : undefined)),
  };
  const client = new PostOrderClient(config as never, budget as never);

  beforeEach(() => {
    jest.clearAllMocks();
    budget.acquire.mockResolvedValue(undefined);
  });

  it('GETs the return search with the documented headers and query, and no offset', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { members: [], paginationOutput: { totalEntries: 0 } } });

    await client.searchReturns('user-token', 'EBAY_US', { creationDateFrom: FROM });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url, cfg] = mockGet.mock.calls[0] as [string, RequestConfig];
    expect(url).toBe('https://api.ebay.com/post-order/v2/return/search');
    expect(cfg.headers).toEqual({
      Authorization: 'IAF user-token',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    expect(cfg.params).toEqual({ creation_date_range_from: FROM, limit: 200, sort: '-FILING_DATE' });
    expect(cfg.params).not.toHaveProperty('offset');
  });

  it('charges the Post-Order return quota at background priority before the call', async () => {
    const order: string[] = [];
    budget.acquire.mockImplementation(() => {
      order.push('budget');
      return Promise.resolve();
    });
    mockGet.mockImplementation(() => {
      order.push('http');
      return Promise.resolve({ status: 200, data: { members: [] } });
    });

    await client.searchReturns('user-token', 'EBAY_US', { creationDateFrom: FROM });

    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.POST_ORDER_RETURN, EbayCallPriority.BACKGROUND);
    expect(order).toEqual(['budget', 'http']);
  });

  it('lets an exhausted budget propagate without calling eBay', async () => {
    budget.acquire.mockRejectedValue(
      new EbayBudgetExhaustedError(EbayApiResource.POST_ORDER_RETURN, new Date('2026-10-01T00:00:00.000Z'))
    );

    await expect(client.searchReturns('user-token', 'EBAY_US', { creationDateFrom: FROM })).rejects.toBeInstanceOf(
      EbayBudgetExhaustedError
    );
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns the members and the pagination eBay sent', async () => {
    const members = [{ returnId: '5000000001' }, { returnId: '5000000002' }];
    const paginationOutput = { limit: 200, offset: 1, totalEntries: 2, totalPages: 1 };
    mockGet.mockResolvedValue({ status: 200, data: { members, paginationOutput, total: 2 } });

    await expect(client.searchReturns('t', 'EBAY_US', { creationDateFrom: FROM })).resolves.toEqual({
      members,
      paginationOutput,
    });
  });

  it('reads a body with no members array as an empty list and drops entries that are not objects', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, data: {} });
    await expect(client.searchReturns('t', 'EBAY_US', { creationDateFrom: FROM })).resolves.toEqual({
      members: [],
      paginationOutput: undefined,
    });

    mockGet.mockResolvedValueOnce({ status: 200, data: { members: [null, 'x', { returnId: '1' }, [1]] } });
    await expect(client.searchReturns('t', 'EBAY_US', { creationDateFrom: FROM })).resolves.toEqual({
      members: [{ returnId: '1' }],
      paginationOutput: undefined,
    });
  });

  it.each([
    ['an HTML page', '<html>Something went wrong on our end</html>'],
    ['nothing', undefined],
    ['null', null],
    ['an array', [{ returnId: '1' }]],
  ])('fails — never an empty list — when the body is %s', async (_label, data) => {
    mockGet.mockResolvedValue({ status: 200, data });

    await expect(client.searchReturns('t', 'EBAY_US', { creationDateFrom: FROM })).rejects.toBeInstanceOf(
      PostOrderResponseError
    );
  });

  it('does not retry a rejection of the request itself', async () => {
    mockGet.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 401'), { response: { status: 401 } })
    );

    await expect(client.searchReturns('t', 'EBAY_US', { creationDateFrom: FROM })).rejects.toThrow('401');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(budget.acquire).toHaveBeenCalledTimes(1);
  });

  it('charges the quota again for a retried transient failure', async () => {
    mockGet
      .mockRejectedValueOnce(
        Object.assign(new Error('Request failed with status code 503'), {
          response: { status: 503, headers: { 'retry-after': '0' } },
        })
      )
      .mockResolvedValueOnce({ status: 200, data: { members: [] } });

    await expect(client.searchReturns('t', 'EBAY_US', { creationDateFrom: FROM })).resolves.toEqual({
      members: [],
      paginationOutput: undefined,
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
    // A retry is a real call against the shared 5,000/day pool.
    expect(budget.acquire).toHaveBeenCalledTimes(2);
  });

  it('reports the return search as unsupported on sandbox keys only', () => {
    const make = (environment: string | undefined): PostOrderClient =>
      new PostOrderClient(
        { get: (key: string) => (key === 'EBAY_ENVIRONMENT' ? environment : undefined) } as never,
        { acquire: jest.fn() } as never
      );
    expect(make('sandbox').isReturnSearchSupported()).toBe(false);
    expect(make(' Sandbox ').isReturnSearchSupported()).toBe(false);
    expect(make('production').isReturnSearchSupported()).toBe(true);
    // Unset reads as production elsewhere in the eBay budget code too.
    expect(make(undefined).isReturnSearchSupported()).toBe(true);
  });

  it('falls back to the production host when EBAY_REST_API_URL is unset', async () => {
    const bare = new PostOrderClient({ get: () => undefined } as never, budget as never);
    mockGet.mockResolvedValue({ status: 200, data: { members: [] } });

    await bare.searchReturns('t', 'EBAY_US', { creationDateFrom: FROM });

    expect((mockGet.mock.calls[0] as [string])[0]).toBe('https://api.ebay.com/post-order/v2/return/search');
  });
});
