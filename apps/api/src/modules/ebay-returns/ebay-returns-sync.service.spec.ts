// apps/api/src/modules/ebay-returns/ebay-returns-sync.service.spec.ts

import { Logger } from '@nestjs/common';
import { EbayApiResource, PlatformSettingKey } from '@repo/shared';

import type { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import type { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import type { EbayService } from '../ebay/ebay.service';

import { EbayReturnsSyncService } from './ebay-returns-sync.service';
import type { PostOrderClient } from './post-order.client';
import type { PostOrderReturnSearchResponse } from './post-order.types';

const USER_A = '00000000-0000-4000-8000-00000000000a';
const USER_B = '00000000-0000-4000-8000-00000000000b';
const ACCOUNT_A = '11111111-1111-4111-8111-11111111111a';
const ACCOUNT_B = '11111111-1111-4111-8111-11111111111b';
const TOKEN_A = 'v^1.1#token-of-store-a';
const TOKEN_B = 'v^1.1#token-of-store-b';
const BUYER = 'very_private_buyer';
const COMMENT = 'The parcel was left in the rain at my door.';

interface ClaimedAccount {
  id: string;
  user_id: string;
  marketplace_id: string | null;
}

const accountA: ClaimedAccount = { id: ACCOUNT_A, user_id: USER_A, marketplace_id: 'EBAY_US' };
const accountB: ClaimedAccount = { id: ACCOUNT_B, user_id: USER_B, marketplace_id: 'EBAY_US' };

const member = (returnId: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  returnId,
  orderId: '12-34567-89012',
  state: 'RETURN_REQUESTED',
  status: 'RETURN_REQUESTED',
  currentType: 'MONEY_BACK',
  buyerLoginName: BUYER,
  creationInfo: {
    comments: { content: COMMENT },
    creationDate: { value: '2026-09-28T10:00:00.000Z' },
    item: { itemId: '110000000006', transactionId: '800000009', returnQuantity: 1 },
    reason: 'ARRIVED_DAMAGED',
    reasonType: 'SNAD',
  },
  sellerResponseDue: {
    activityDue: 'SELLER_APPROVE_REQUEST',
    respondByDate: { value: '2026-10-02T10:00:00.000Z' },
  },
  sellerTotalRefund: { estimatedRefundAmount: { value: 27.5, currency: 'USD' } },
  ...over,
});

interface Harness {
  service: EbayReturnsSyncService;
  query: jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;
  getBoolean: jest.Mock<Promise<boolean>, [PlatformSettingKey]>;
  getNumber: jest.Mock<Promise<number>, [PlatformSettingKey]>;
  isSuspended: jest.Mock<Promise<boolean>, [string]>;
  getAccountAccessToken: jest.Mock<Promise<string>, [string]>;
  searchReturns: jest.Mock<Promise<PostOrderReturnSearchResponse>, [string, string, { creationDateFrom: string }]>;
  claims(): Array<[string, unknown[]?]>;
  upserts(): Array<[string, unknown[]?]>;
}

function build(options: {
  enabled?: boolean;
  accounts?: ClaimedAccount[];
  suspended?: string[];
  tokens?: Record<string, string>;
  failUpsertFor?: string[];
  sandbox?: boolean;
}): Harness {
  const accounts = options.accounts ?? [];
  const tokens = options.tokens ?? { [ACCOUNT_A]: TOKEN_A, [ACCOUNT_B]: TOKEN_B };

  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>((sql, params) => {
    if (sql.includes('UPDATE ebay_accounts')) {
      return Promise.resolve(accounts);
    }
    if (sql.includes('INSERT INTO ebay_returns') && options.failUpsertFor?.includes(String(params?.[2]))) {
      return Promise.reject(new Error('value too long for type character varying(40)'));
    }
    return Promise.resolve([]);
  });
  const getBoolean = jest.fn<Promise<boolean>, [PlatformSettingKey]>(() => Promise.resolve(options.enabled ?? true));
  const getNumber = jest.fn<Promise<number>, [PlatformSettingKey]>((key) =>
    Promise.resolve(key === PlatformSettingKey.EBAY_RETURN_SYNC_INTERVAL_HOURS ? 6 : 25)
  );
  const isSuspended = jest.fn<Promise<boolean>, [string]>((userId) =>
    Promise.resolve(options.suspended?.includes(userId) ?? false)
  );
  const getAccountAccessToken = jest.fn<Promise<string>, [string]>((accountId) =>
    Promise.resolve(tokens[accountId] ?? '')
  );
  const searchReturns = jest.fn<Promise<PostOrderReturnSearchResponse>, [string, string, { creationDateFrom: string }]>(
    () => Promise.resolve({ members: [] })
  );

  const service = new EbayReturnsSyncService(
    { query } as unknown as DatabaseService,
    { getBoolean, getNumber } as unknown as PlatformSettingsService,
    { isSuspended } as unknown as QuotaEnforcementService,
    { getAccountAccessToken } as unknown as EbayService,
    { searchReturns, isReturnSearchSupported: () => options.sandbox !== true } as unknown as PostOrderClient
  );

  const matching = (needle: string) => (): Array<[string, unknown[]?]> =>
    query.mock.calls.filter(([sql]) => sql.includes(needle));

  return {
    service,
    query,
    getBoolean,
    getNumber,
    isSuspended,
    getAccountAccessToken,
    searchReturns,
    claims: matching('UPDATE ebay_accounts'),
    upserts: matching('INSERT INTO ebay_returns'),
  };
}

describe('EbayReturnsSyncService', () => {
  let warn: jest.SpyInstance;
  let debug: jest.SpyInstance;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const everyLogLine = (): string =>
    [warn, debug, log, error]
      .flatMap((spy) => (spy.mock.calls as unknown[][]).map((call) => call.map(String).join(' ')))
      .join('\n');

  it('claims nothing and calls nothing when the feature is switched off', async () => {
    const h = build({ enabled: false, accounts: [accountA] });

    await h.service.sweep();

    expect(h.getBoolean).toHaveBeenCalledWith(PlatformSettingKey.EBAY_RETURN_SYNC_ENABLED);
    expect(h.query).not.toHaveBeenCalled();
    expect(h.getAccountAccessToken).not.toHaveBeenCalled();
    expect(h.searchReturns).not.toHaveBeenCalled();
  });

  it('claims nothing and calls nothing on sandbox keys, where eBay does not support the search', async () => {
    const h = build({ sandbox: true, accounts: [accountA] });

    await h.service.sweep();

    expect(h.query).not.toHaveBeenCalled();
    expect(h.getAccountAccessToken).not.toHaveBeenCalled();
    expect(h.searchReturns).not.toHaveBeenCalled();
  });

  it('claims due ACTIVE stores and stamps the watermark in the same statement', async () => {
    const h = build({ accounts: [] });

    await h.service.sweep();

    expect(h.claims()).toHaveLength(1);
    const [sql, params] = h.claims()[0];
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('SET last_return_sync_at = NOW()');
    expect(sql).toContain('last_return_sync_at IS NULL');
    expect(sql).toContain('RETURNING a.id, a.user_id, a.marketplace_id');
    // intervalHours, maxAccountsPerRun — both from the settings, never literals.
    expect(params).toEqual(['6', 25]);
    expect(h.getNumber).toHaveBeenCalledWith(PlatformSettingKey.EBAY_RETURN_SYNC_INTERVAL_HOURS);
    expect(h.getNumber).toHaveBeenCalledWith(PlatformSettingKey.EBAY_RETURN_SYNC_MAX_ACCOUNTS_PER_RUN);
    expect(h.searchReturns).not.toHaveBeenCalled();
  });

  it('reads a claimed store with its own raw token and upserts what eBay returned', async () => {
    const h = build({ accounts: [accountA] });
    h.searchReturns.mockResolvedValue({ members: [member('5000000001'), member('5000000002', { state: 'CLOSED' })] });

    const before = Date.now();
    await h.service.sweep();
    const after = Date.now();

    expect(h.getAccountAccessToken).toHaveBeenCalledWith(ACCOUNT_A);
    expect(h.searchReturns).toHaveBeenCalledTimes(1);
    const [token, marketplaceId, search] = h.searchReturns.mock.calls[0];
    // The raw user token: the client is what prefixes it for the header.
    expect(token).toBe(TOKEN_A);
    expect(marketplaceId).toBe('EBAY_US');

    // 90 days back, so eBay's "goes forward for the following 90 days" reaches today.
    const from = new Date(search.creationDateFrom).getTime();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    expect(search.creationDateFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(from).toBeGreaterThanOrEqual(before - ninetyDays);
    expect(from).toBeLessThanOrEqual(after - ninetyDays);

    expect(h.upserts()).toHaveLength(2);
    const [sql, params] = h.upserts()[0];
    expect(sql).toContain('ON CONFLICT (ebay_account_id, return_id) DO UPDATE');
    expect(sql).toContain('last_synced_at = NOW()');
    expect(sql).toContain('updated_at = NOW()');
    // The order link is looked up for THIS seller only, and an existing link survives.
    expect(sql).toContain('o.ebay_order_id = $4::text AND o.user_id = $1::uuid');
    expect(sql).toContain('order_id = COALESCE(ebay_returns.order_id, EXCLUDED.order_id)');
    expect(sql).not.toContain('first_seen_at');
    expect(params).toEqual([
      USER_A,
      ACCOUNT_A,
      '5000000001',
      '12-34567-89012',
      '110000000006',
      '800000009',
      1,
      'RETURN_REQUESTED',
      'RETURN_REQUESTED',
      'MONEY_BACK',
      'ARRIVED_DAMAGED',
      'SNAD',
      COMMENT,
      BUYER,
      'SELLER_APPROVE_REQUEST',
      '2026-10-02T10:00:00.000Z',
      27.5,
      null,
      'USD',
      null,
      '2026-09-28T10:00:00.000Z',
    ]);
    expect(h.upserts()[1][1]?.[7]).toBe('CLOSED');
  });

  it('overwrites a seller action eBay no longer reports with NULL', async () => {
    const h = build({ accounts: [accountA] });
    h.searchReturns.mockResolvedValue({ members: [member('5000000001', { sellerResponseDue: undefined })] });

    await h.service.sweep();

    const [sql, params] = h.upserts()[0];
    expect(sql).toContain('seller_activity_due = EXCLUDED.seller_activity_due');
    expect(sql).toContain('seller_respond_by = EXCLUDED.seller_respond_by');
    expect(params?.[14]).toBeNull();
    expect(params?.[15]).toBeNull();
  });

  it('skips a store with no token and still processes the next one', async () => {
    const h = build({ accounts: [accountA, accountB], tokens: { [ACCOUNT_B]: TOKEN_B } });
    h.searchReturns.mockResolvedValue({ members: [member('5000000009')] });

    await expect(h.service.sweep()).resolves.toBeUndefined();

    expect(h.searchReturns).toHaveBeenCalledTimes(1);
    expect(h.searchReturns.mock.calls[0][0]).toBe(TOKEN_B);
    expect(h.upserts()).toHaveLength(1);
    expect(h.upserts()[0][1]?.[1]).toBe(ACCOUNT_B);
  });

  it('skips a store whose token cannot be obtained and still processes the next one', async () => {
    const h = build({ accounts: [accountA, accountB] });
    h.getAccountAccessToken.mockImplementation((accountId) =>
      accountId === ACCOUNT_A ? Promise.reject(new Error('refresh token revoked')) : Promise.resolve(TOKEN_B)
    );

    await expect(h.service.sweep()).resolves.toBeUndefined();

    expect(h.searchReturns).toHaveBeenCalledTimes(1);
    expect(h.searchReturns.mock.calls[0][0]).toBe(TOKEN_B);
    expect(warn.mock.calls.some(([line]) => String(line).includes(ACCOUNT_A))).toBe(true);
  });

  it('skips a store with no marketplace id rather than guessing one', async () => {
    const h = build({ accounts: [{ ...accountA, marketplace_id: null }, accountB] });

    await h.service.sweep();

    expect(h.searchReturns).toHaveBeenCalledTimes(1);
    expect(h.searchReturns.mock.calls[0][0]).toBe(TOKEN_B);
  });

  it('never throws out of sweep() when the client throws, and processes the next store', async () => {
    const h = build({ accounts: [accountA, accountB] });
    h.searchReturns.mockImplementation((token) =>
      token === TOKEN_A
        ? Promise.reject(Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } }))
        : Promise.resolve({ members: [member('5000000003')] })
    );

    await expect(h.service.sweep()).resolves.toBeUndefined();

    expect(h.searchReturns).toHaveBeenCalledTimes(2);
    expect(h.upserts()).toHaveLength(1);
    expect(h.upserts()[0][1]?.[1]).toBe(ACCOUNT_B);
    const failure = warn.mock.calls.map(([line]) => String(line)).find((line) => line.includes(ACCOUNT_A));
    expect(failure).toContain('HTTP 500');
  });

  it('never deletes or blanks rows when a fetch fails', async () => {
    const h = build({ accounts: [accountA] });
    h.searchReturns.mockRejectedValue(new Error('socket hang up'));

    await h.service.sweep();

    // The claim is the only statement issued for a store that could not be read.
    expect(h.query).toHaveBeenCalledTimes(1);
    expect(h.query.mock.calls.every(([sql]) => !/\bDELETE\b/i.test(sql))).toBe(true);
  });

  it('skips a suspended owner without asking for a token or calling eBay', async () => {
    const h = build({ accounts: [accountA, accountB], suspended: [USER_A] });

    await h.service.sweep();

    expect(h.isSuspended).toHaveBeenCalledWith(USER_A);
    expect(h.getAccountAccessToken).not.toHaveBeenCalledWith(ACCOUNT_A);
    expect(h.getAccountAccessToken).toHaveBeenCalledWith(ACCOUNT_B);
    expect(h.searchReturns).toHaveBeenCalledTimes(1);
    expect(h.searchReturns.mock.calls[0][0]).toBe(TOKEN_B);
  });

  it('stops the sweep when the shared eBay budget is exhausted, without throwing', async () => {
    const h = build({ accounts: [accountA, accountB] });
    h.searchReturns.mockRejectedValue(
      new EbayBudgetExhaustedError(EbayApiResource.POST_ORDER_RETURN, new Date('2026-10-01T00:00:00.000Z'))
    );

    await expect(h.service.sweep()).resolves.toBeUndefined();

    expect(h.searchReturns).toHaveBeenCalledTimes(1);
    expect(h.getAccountAccessToken).not.toHaveBeenCalledWith(ACCOUNT_B);
    // Nothing is un-stamped: the claim is the only write to ebay_accounts.
    expect(h.query.mock.calls.filter(([sql]) => sql.includes('ebay_accounts'))).toHaveLength(1);
  });

  it('does not store a member without a return id', async () => {
    const h = build({ accounts: [accountA] });
    h.searchReturns.mockResolvedValue({ members: [{ orderId: '12-34567-89012' }, member('5000000004')] });

    await h.service.sweep();

    expect(h.upserts()).toHaveLength(1);
    expect(h.upserts()[0][1]?.[2]).toBe('5000000004');
  });

  it('keeps writing the other returns when the database refuses one row', async () => {
    const h = build({ accounts: [accountA, accountB], failUpsertFor: ['5000000005'] });
    h.searchReturns.mockImplementation((token) =>
      Promise.resolve(
        token === TOKEN_A
          ? { members: [member('5000000005'), member('5000000006')] }
          : { members: [member('5000000007')] }
      )
    );

    await expect(h.service.sweep()).resolves.toBeUndefined();

    expect(h.upserts().map(([, params]) => params?.[2])).toEqual(['5000000005', '5000000006', '5000000007']);
  });

  it('warns ONCE, with the account and both numbers, when eBay reports more returns than it sent', async () => {
    const h = build({ accounts: [accountA] });
    h.searchReturns.mockResolvedValue({
      members: [member('5000000001'), member('5000000002')],
      paginationOutput: { totalEntries: 431, limit: 200, totalPages: 3 },
    });

    await h.service.sweep();

    const lines = warn.mock.calls.map(([line]) => String(line)).filter((line) => line.includes('431'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(ACCOUNT_A);
    expect(lines[0]).toContain('2 of 431');
  });

  it('does not warn when eBay sent everything it reports', async () => {
    const h = build({ accounts: [accountA] });
    h.searchReturns.mockResolvedValue({
      members: [member('5000000001')],
      paginationOutput: { totalEntries: 1, limit: 200, totalPages: 1 },
    });

    await h.service.sweep();

    expect(warn).not.toHaveBeenCalled();
  });

  it('never logs a buyer name, a buyer comment or a token', async () => {
    const h = build({ accounts: [accountA, accountB], failUpsertFor: ['5000000008'] });
    h.searchReturns.mockImplementation((token) =>
      token === TOKEN_A
        ? Promise.resolve({
            members: [member('5000000008'), { buyerLoginName: BUYER }],
            paginationOutput: { totalEntries: 900 },
          })
        : Promise.reject(
            Object.assign(new Error('Request failed with status code 401'), {
              response: { status: 401, data: { buyerLoginName: BUYER, comments: COMMENT } },
              config: { headers: { Authorization: `IAF ${TOKEN_B}` } },
            })
          )
    );

    await h.service.sweep();

    const lines = everyLogLine();
    expect(lines).not.toBe('');
    expect(lines).not.toContain(BUYER);
    expect(lines).not.toContain(COMMENT);
    expect(lines).not.toContain(TOKEN_A);
    expect(lines).not.toContain(TOKEN_B);
  });
});
