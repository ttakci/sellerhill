import { readFileSync } from 'fs';
import { join } from 'path';

import { EbayAccountStatus } from '@repo/shared';
import axios from 'axios';

import { EbayService } from './ebay.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Store-scoped eBay calls. A seller with two stores used to have business
 * policies read, and listings ended, through `getActiveAccount(userId)` — an
 * unordered `LIMIT 1`, i.e. an arbitrary store. Policy ids and item ids belong
 * to ONE store, so both now resolve the store they are for.
 */
describe('EbayService — store-scoped calls', () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const accounts = {
    'store-a': { id: 'store-a', user_id: 'user-1', status: EbayAccountStatus.ACTIVE, marketplace_id: 'EBAY_US', access_token: 'token-a', access_token_expires_at: future },
    'store-b': { id: 'store-b', user_id: 'user-1', status: EbayAccountStatus.ACTIVE, marketplace_id: 'EBAY_US', access_token: 'token-b', access_token_expires_at: future },
  } as const;

  function build() {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      query: jest.fn((sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (/FROM ebay_accounts WHERE id = \$1 AND user_id = \$2/.test(sql)) {
          const row = accounts[params[0] as keyof typeof accounts];
          return Promise.resolve(row && row.user_id === params[1] ? [row] : []);
        }
        if (/ORDER BY created_at ASC, id ASC/.test(sql)) {
          return Promise.resolve([accounts['store-a']]);
        }
        return Promise.resolve([]);
      }),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'AMAZON_ENCRYPTION_KEY') {return '0'.repeat(64);}
        if (key === 'EBAY_REST_API_URL') {return 'https://api.ebay.test';}
        if (key === 'EBAY_XML_API_URL') {return 'https://api.ebay.test/ws';}
        return undefined;
      }),
    };
    const budget = { acquire: jest.fn().mockResolvedValue(undefined) };
    const service = new EbayService(
      {} as never,
      db as never,
      config as never,
      {} as never,
      {} as never,
      {} as never,
      budget as never,
      {} as never
    );
    return { service, queries };
  }

  const authHeaders = () =>
    mockedAxios.get.mock.calls.map(([, options]) => (options as { headers: Record<string, string> }).headers.Authorization);

  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockResolvedValue({ data: {} });
  });

  it('reads the business policies of the store that was named', async () => {
    const { service } = build();
    await service.getBusinessPolicies('user-1', 'store-b');
    expect(mockedAxios.get.mock.calls).toHaveLength(3);
    expect(authHeaders()).toEqual(['Bearer token-b', 'Bearer token-b', 'Bearer token-b']);
  });

  it('refuses a store that does not belong to the caller', async () => {
    const { service } = build();
    await expect(service.getBusinessPolicies('user-2', 'store-b')).rejects.toThrow(/not found/);
    expect(mockedAxios.get.mock.calls).toHaveLength(0);
  });

  it('falls back to the oldest active store, never an unordered LIMIT 1, when no store is named', async () => {
    const { service, queries } = build();
    await service.getBusinessPolicies('user-1');
    expect(authHeaders()[0]).toBe('Bearer token-a');
    expect(queries.some((q) => /ORDER BY created_at ASC, id ASC/.test(q.sql))).toBe(true);
  });

  it("ends a listing through the listing's own store token", async () => {
    const { service } = build();
    mockedAxios.post.mockResolvedValue({ data: '<EndItemResponse><Ack>Success</Ack></EndItemResponse>' });
    await service.withdrawOffer('user-1', 'store-b', '123456789');
    const headers = (mockedAxios.post.mock.calls[0][2] as { headers: Record<string, string> }).headers;
    expect(headers['X-EBAY-API-IAF-TOKEN']).toBe('token-b');
  });

  it('source: no store-scoped path asks for an arbitrary active account', () => {
    const source = readFileSync(join(__dirname, 'ebay.service.ts'), 'utf8').replace(/\r\n/g, '\n');
    const body = (name: string) => {
      const start = source.indexOf(`  async ${name}(`);
      const end = source.indexOf('\n  }\n', start);
      return source.slice(start, end);
    };
    for (const method of ['getBusinessPolicies', 'withdrawOffer', 'prepareListingDraft']) {
      expect(body(method)).not.toContain('getActiveAccount(');
    }
    expect(source).not.toContain('async updatePriceAndStock(');
  });
});
