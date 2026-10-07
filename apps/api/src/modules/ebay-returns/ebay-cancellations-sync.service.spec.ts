// apps/api/src/modules/ebay-returns/ebay-cancellations-sync.service.spec.ts

import { Logger } from '@nestjs/common';
import { EbayApiResource, PlatformSettingKey } from '@repo/shared';

import type { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import type { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import type { EbayService } from '../ebay/ebay.service';

import { EbayCancellationsSyncService } from './ebay-cancellations-sync.service';
import type { PostOrderClient } from './post-order.client';
import type { PostOrderCancellationSearchResponse } from './post-order.types';
import type { ReturnSweepScheduleService } from './return-sweep-schedule.service';

const USER_A = '00000000-0000-4000-8000-00000000000a';
const ACCOUNT_A = '11111111-1111-4111-8111-11111111111a';
const ACCOUNT_B = '11111111-1111-4111-8111-11111111111b';
const TOKEN_A = 'v^1.1#token-of-store-a';
const TOKEN_B = 'v^1.1#token-of-store-b';
const BUYER = 'very_private_buyer';

interface ClaimedAccount {
  id: string;
  user_id: string;
  marketplace_id: string | null;
}

const accountA: ClaimedAccount = { id: ACCOUNT_A, user_id: USER_A, marketplace_id: 'EBAY_US' };
const accountB: ClaimedAccount = { id: ACCOUNT_B, user_id: USER_A, marketplace_id: 'EBAY_GB' };

const entry = (cancelId: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  cancelId,
  marketplaceId: 'EBAY_US',
  legacyOrderId: '12-34567-89012',
  requestorType: 'BUYER',
  cancelReason: 'BUYER_ASKED_CANCEL',
  cancelState: 'REFUND_PENDING',
  cancelStatus: 'CANCEL_PENDING',
  paymentStatus: 'ONLINE_PAID',
  buyerLoginName: BUYER,
  requestRefundAmount: { value: 41.9, currency: 'USD' },
  cancelRequestDate: { value: '2026-10-06T10:00:00.000Z' },
  sellerResponseDueDate: { value: '2026-10-09T10:00:00.000Z' },
  ...over,
});

function build(options: { enabled?: boolean; accounts?: ClaimedAccount[]; sandbox?: boolean; suspended?: boolean } = {}) {
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>((sql) =>
    Promise.resolve(sql.includes('UPDATE ebay_accounts') ? (options.accounts ?? []) : [])
  );
  const getBoolean = jest.fn<Promise<boolean>, [PlatformSettingKey]>(() => Promise.resolve(options.enabled ?? true));
  const getNumber = jest.fn<Promise<number>, [PlatformSettingKey]>(() => Promise.resolve(35));
  const isSuspended = jest.fn<Promise<boolean>, [string]>(() => Promise.resolve(options.suspended ?? false));
  const getAccountAccessToken = jest.fn<Promise<string>, [string]>((id) =>
    Promise.resolve(id === ACCOUNT_A ? TOKEN_A : TOKEN_B)
  );
  const searchCancellations = jest.fn<
    Promise<PostOrderCancellationSearchResponse>,
    [string, string, { creationDateFrom: string }]
  >(() => Promise.resolve({ cancellations: [] }));
  const resolveCancellations = jest.fn(() =>
    Promise.resolve({ intervalHours: 6, source: 'auto', estimatedDailyCalls: 0 })
  );

  const service = new EbayCancellationsSyncService(
    { query } as unknown as DatabaseService,
    { getBoolean, getNumber } as unknown as PlatformSettingsService,
    { isSuspended } as unknown as QuotaEnforcementService,
    { getAccountAccessToken } as unknown as EbayService,
    { searchCancellations, isReturnSearchSupported: () => options.sandbox !== true } as unknown as PostOrderClient,
    { resolveCancellations } as unknown as ReturnSweepScheduleService
  );
  const matching = (needle: string) => query.mock.calls.filter(([sql]) => sql.includes(needle));
  return {
    service,
    query,
    getBoolean,
    getNumber,
    getAccountAccessToken,
    searchCancellations,
    resolveCancellations,
    claims: () => matching('UPDATE ebay_accounts'),
    upserts: () => matching('INSERT INTO ebay_cancellations'),
  };
}

describe('EbayCancellationsSyncService', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('claims nothing when its own switch is off, or on sandbox keys', async () => {
    const off = build({ enabled: false, accounts: [accountA] });
    await off.service.sweep();
    expect(off.getBoolean).toHaveBeenCalledWith(PlatformSettingKey.EBAY_CANCELLATION_SYNC_ENABLED);
    expect(off.query).not.toHaveBeenCalled();

    const sandbox = build({ sandbox: true, accounts: [accountA] });
    await sandbox.service.sweep();
    expect(sandbox.query).not.toHaveBeenCalled();
    expect(sandbox.searchCancellations).not.toHaveBeenCalled();
  });

  it('claims due ACTIVE stores in one statement, on the cancellation interval, with the express lane', async () => {
    const h = build();
    await h.service.sweep();

    expect(h.resolveCancellations).toHaveBeenCalled();
    expect(h.claims()).toHaveLength(1);
    const [sql, params] = h.claims()[0];
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('SET last_cancellation_sync_at = NOW()');
    expect(sql).toContain('last_cancellation_sync_at IS NULL');
    // Express lane: order sync saw a cancel state other than none / done, after the last read.
    expect(sql).toContain("o.ebay_cancel_state NOT IN ('NONE_REQUESTED', 'CANCELED')");
    expect(sql).toContain('o.updated_at > ebay_accounts.last_cancellation_sync_at');
    expect(sql).toContain('o.ebay_account_id = ebay_accounts.id');
    // …bounded: at most one extra sweep an hour, and only while no stored request is linked to that order.
    expect(sql).toContain("last_cancellation_sync_at < NOW() - INTERVAL '1 hour'");
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM ebay_cancellations c WHERE c.order_id = o.id)');
    // The return sweep's burst guard, the cancellation interval.
    expect(params).toEqual(['6', 35]);
    expect(h.getNumber).toHaveBeenCalledWith(PlatformSettingKey.EBAY_RETURN_SYNC_MAX_ACCOUNTS_PER_RUN);
  });

  it('reads 90 days of a claimed store with its raw token and upserts what eBay returned', async () => {
    const h = build({ accounts: [accountA] });
    h.searchCancellations.mockResolvedValue({ cancellations: [entry('5000000001'), entry('5000000002')] });
    const before = Date.now();
    await h.service.sweep();

    const [token, marketplaceId, search] = h.searchCancellations.mock.calls[0];
    expect(token).toBe(TOKEN_A);
    expect(marketplaceId).toBe('EBAY_US');
    expect(new Date(search.creationDateFrom).getTime()).toBeLessThanOrEqual(before - 90 * 24 * 3_600_000 + 1000);

    expect(h.upserts()).toHaveLength(2);
    const [sql, params] = h.upserts()[0];
    expect(sql).toContain('ON CONFLICT (ebay_account_id, cancel_id) DO UPDATE SET');
    expect(sql).toContain('o.ebay_order_id = $4::text AND o.user_id = $1::uuid AND o.ebay_account_id = $2::uuid');
    expect(sql).toContain('order_id = COALESCE(ebay_cancellations.order_id, EXCLUDED.order_id)');
    expect(sql).toContain('seller_respond_by = EXCLUDED.seller_respond_by');
    expect(sql).toContain('last_synced_at = NOW()');
    expect(sql).not.toContain('first_seen_at');
    expect(params).toEqual([
      USER_A,
      ACCOUNT_A,
      '5000000001',
      '12-34567-89012',
      'EBAY_US',
      'BUYER',
      'REFUND_PENDING',
      'CANCEL_PENDING',
      'BUYER_ASKED_CANCEL',
      null,
      BUYER,
      '2026-10-06T10:00:00.000Z',
      '2026-10-09T10:00:00.000Z',
      null,
      null,
      41.9,
      'USD',
      'ONLINE_PAID',
    ]);
  });

  it('keeps the buyer login NULL on an erased row', async () => {
    const h = build({ accounts: [accountA] });
    h.searchCancellations.mockResolvedValue({ cancellations: [entry('5000000001')] });
    await h.service.sweep();
    expect(h.upserts()[0][0]).toMatch(
      /buyer_login_name = CASE\s+WHEN ebay_cancellations\.buyer_data_erased_at IS NOT NULL THEN NULL\s+ELSE EXCLUDED\.buyer_login_name\s+END/
    );
  });

  it('skips an entry without a cancel id and warns when eBay reports more than one page', async () => {
    const h = build({ accounts: [accountA] });
    h.searchCancellations.mockResolvedValue({
      cancellations: [{ legacyOrderId: 'x' }, entry('5000000003')],
      paginationOutput: { totalEntries: 812 },
    });
    await h.service.sweep();
    expect(h.upserts()).toHaveLength(1);
    expect(warn.mock.calls.map(([line]) => String(line)).some((line) => line.includes('2 of 812'))).toBe(true);
  });

  it('stops at an exhausted budget, keeps going past one failing store, and never logs a buyer or a token', async () => {
    const exhausted = build({ accounts: [accountA, accountB] });
    exhausted.searchCancellations.mockRejectedValue(
      new EbayBudgetExhaustedError(EbayApiResource.POST_ORDER_CANCELLATION, new Date('2026-10-08T00:00:00.000Z'))
    );
    await expect(exhausted.service.sweep()).resolves.toBeUndefined();
    expect(exhausted.searchCancellations).toHaveBeenCalledTimes(1);

    const failing = build({ accounts: [accountA, accountB] });
    failing.searchCancellations.mockImplementation((token) =>
      token === TOKEN_A
        ? Promise.reject(Object.assign(new Error('boom'), { response: { status: 500, data: { buyerLoginName: BUYER } } }))
        : Promise.resolve({ cancellations: [entry('5000000004')] })
    );
    await failing.service.sweep();
    expect(failing.upserts()).toHaveLength(1);
    const lines = warn.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
    expect(lines).toContain('HTTP 500');
    expect(lines).not.toContain(BUYER);
    expect(lines).not.toContain(TOKEN_A);
  });

  it('skips a suspended owner without asking for a token', async () => {
    const h = build({ accounts: [accountA], suspended: true });
    await h.service.sweep();
    expect(h.getAccountAccessToken).not.toHaveBeenCalled();
    expect(h.searchCancellations).not.toHaveBeenCalled();
  });
});
