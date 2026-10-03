import { EbayAccountStatus } from '@repo/shared';
import axios from 'axios';

import { EbayService } from './ebay.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Store-scoped token access. A token is handed out only for an ACTIVE store
 * (a disconnected one has NULLed tokens), and a listing that names no store is
 * resolved only when the seller has exactly ONE active store — never guessed.
 */
describe('EbayService — account scope', () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const active = {
    id: 'store-a',
    user_id: 'user-1',
    status: EbayAccountStatus.ACTIVE,
    marketplace_id: 'EBAY_US',
    access_token: 'token-a',
    access_token_expires_at: future,
  };

  function build(rows: (sql: string, params: unknown[]) => unknown[]) {
    const db = { query: jest.fn((sql: string, params: unknown[] = []) => Promise.resolve(rows(sql, params))) };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'AMAZON_ENCRYPTION_KEY') {return '0'.repeat(64);}
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
    return { service, db };
  }

  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  describe('getAccountAccessToken', () => {
    it('reads only an ACTIVE store', async () => {
      const { service, db } = build((_sql, params) =>
        params[0] === 'store-a' && params[1] === EbayAccountStatus.ACTIVE ? [active] : []
      );
      await expect(service.getAccountAccessToken('store-a')).resolves.toBe('token-a');
      const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('WHERE id = $1 AND status = $2');
      expect(params).toEqual(['store-a', EbayAccountStatus.ACTIVE]);
    });

    it('throws for a store that is not active (the caller fails closed)', async () => {
      const { service } = build(() => []);
      await expect(service.getAccountAccessToken('store-x')).rejects.toThrow(/not found/);
    });
  });

  describe('discoverActiveListings', () => {
    it('refuses a non-active store before any eBay call', async () => {
      const { service, db } = build(() => []);
      await expect(service.discoverActiveListings('store-x')).rejects.toThrow(/not found/);
      const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('WHERE id = $1 AND status = $2');
      expect(params).toEqual(['store-x', EbayAccountStatus.ACTIVE]);
      expect(mockedAxios.post.mock.calls).toHaveLength(0);
    });
  });

  describe('resolveListingAccountId', () => {
    it('returns the store the listing names, without a query', async () => {
      const { service, db } = build(() => []);
      await expect(service.resolveListingAccountId('user-1', 'store-b')).resolves.toBe('store-b');
      expect(db.query).not.toHaveBeenCalled();
    });

    it('resolves a store-less listing when the seller has exactly one active store', async () => {
      const { service } = build(() => [{ id: 'store-a' }]);
      await expect(service.resolveListingAccountId('user-1', null)).resolves.toBe('store-a');
    });

    it('refuses to guess when the seller has several active stores', async () => {
      const { service, db } = build(() => [{ id: 'store-a' }, { id: 'store-b' }]);
      await expect(service.resolveListingAccountId('user-1', null)).resolves.toBeNull();
      const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('LIMIT 2');
      expect(params).toEqual(['user-1', EbayAccountStatus.ACTIVE]);
    });

    it('returns null when the seller has no active store', async () => {
      const { service } = build(() => []);
      await expect(service.resolveListingAccountId('user-1', null)).resolves.toBeNull();
    });
  });
});
