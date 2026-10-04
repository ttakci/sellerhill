import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ListingFailureCode, ListingStatus } from '@repo/shared';

import { ListingProcessorService } from './listing-processor.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

/**
 * Every create, filter and edit names ONE store (or one settings group) and
 * must only ever touch what the caller owns. These lock the multi-store gaps
 * that used to leave a job "Queued" forever or a listing pointing at a stranger's
 * settings group.
 */

const STORE = '11111111-1111-4111-8111-111111111111';
const GROUP = '22222222-2222-4222-8222-222222222222';

type Query = jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;

function buildService(
  respond: (sql: string, params: unknown[]) => unknown[] = () => [],
  ebay: Record<string, unknown> = {}
): { service: ListingsService; db: { query: Query }; ebay: Record<string, jest.Mock> } {
  const db = { query: jest.fn((sql: string, params: unknown[] = []) => Promise.resolve(respond(sql, params))) as Query };
  const ebayFake = { assertAccountOwnership: jest.fn().mockResolvedValue(undefined), ...ebay } as Record<string, jest.Mock>;
  const service = new ListingsService(
    db as never,
    ebayFake as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
  return { service, db, ebay: ebayFake };
}

const sqlOf = (db: { query: Query }): string[] => db.query.mock.calls.map((call) => call[0]);

describe('createJob — the store must be usable before anything is written', () => {
  const request = {
    asins: ['B0SH000001'],
    ebayAccountId: STORE,
    listingSettingsGroupId: GROUP,
    paymentPolicyId: 'p',
    shippingPolicyId: 's',
    returnPolicyId: 'r',
  };

  it('refuses a store the seller does not own (or that is not active) with a 400 and writes no job', async () => {
    const { service, db } = buildService(() => [], {
      assertAccountOwnership: jest.fn().mockRejectedValue(new NotFoundException('Active eBay account not found')),
    });

    await expect(service.createJob('user-1', request)).rejects.toThrow(
      new BadRequestException('listings.errors.storeUnavailable')
    );
    expect(sqlOf(db).some((sql) => /INSERT INTO listing_jobs/.test(sql))).toBe(false);
  });

  it('refuses a malformed store id before it reaches the database', async () => {
    const { service, db, ebay } = buildService();

    await expect(service.createJob('user-1', { ...request, ebayAccountId: 'not-a-uuid' })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(ebay.assertAccountOwnership).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('a transient ownership-check failure is not reported as a missing store', async () => {
    const { service } = buildService(() => [], {
      assertAccountOwnership: jest.fn().mockRejectedValue(new Error('connection reset')),
    });

    await expect(service.createJob('user-1', request)).rejects.toThrow('connection reset');
  });
});

describe('processListingBatch — a store that became unusable closes the batch', () => {
  function buildProcessor(ownership: () => Promise<void>, settingsGroup?: () => Promise<unknown>) {
    const listingsService = {
      isJobCancelled: jest.fn().mockResolvedValue(false),
      markJobProcessing: jest.fn().mockResolvedValue(undefined),
      updateJobItemResult: jest.fn().mockResolvedValue(undefined),
    };
    const ebayService = { assertAccountOwnership: jest.fn(ownership) };
    const quota = {
      releaseForCreate: jest.fn().mockResolvedValue(undefined),
      reserveForBulkCreate: jest.fn().mockResolvedValue(undefined),
    };
    const storeSettings = { getResolvedSettings: jest.fn().mockResolvedValue({}) };
    const strategy = { getSettingsGroup: jest.fn(settingsGroup ?? (() => Promise.resolve({}))) };
    const processor = new ListingProcessorService(
      listingsService as never,
      {} as never,
      {} as never,
      ebayService as never,
      {} as never,
      strategy as never,
      quota as never,
      {} as never,
      {} as never,
      {} as never,
      storeSettings as never,
      {} as never,
      {} as never
    );
    const job = {
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        jobId: 'job-1',
        userId: 'user-1',
        ebayAccountId: STORE,
        listingSettingsGroupId: GROUP,
        paymentPolicyId: 'p',
        shippingPolicyId: 's',
        returnPolicyId: 'r',
        asDraft: false,
        items: [
          { asin: 'B0SH000001', listingJobItemId: 'item-1' },
          { asin: 'B0SH000002', listingJobItemId: 'item-2' },
        ],
      },
    };
    const run = (): Promise<void> =>
      (processor as unknown as { processListingBatch(j: unknown): Promise<void> }).processListingBatch(job);
    return { run, listingsService, quota, storeSettings };
  }

  it('fails every item terminally with the account reason and releases each reservation', async () => {
    const { run, listingsService, quota, storeSettings } = buildProcessor(() =>
      Promise.reject(new NotFoundException('Active eBay account not found'))
    );

    await expect(run()).resolves.toBeUndefined();

    expect(listingsService.updateJobItemResult).toHaveBeenCalledTimes(2);
    for (const [, , result] of listingsService.updateJobItemResult.mock.calls as Array<
      [string, string, { status: ListingStatus; failureCode: ListingFailureCode; failureDetails: { retryable?: boolean } }]
    >) {
      expect(result.status).toBe(ListingStatus.ERROR);
      expect(result.failureCode).toBe(ListingFailureCode.EBAY_AUTH);
      expect(result.failureDetails.retryable).toBe(false);
    }
    expect(quota.releaseForCreate).toHaveBeenCalledWith('user-1', 'item-1');
    expect(quota.releaseForCreate).toHaveBeenCalledWith('user-1', 'item-2');
    // Nothing past the store check runs.
    expect(storeSettings.getResolvedSettings).not.toHaveBeenCalled();
  });

  it('a transient failure of the check still goes to BullMQ for a retry', async () => {
    const { run, listingsService } = buildProcessor(() => Promise.reject(new Error('connection reset')));

    await expect(run()).rejects.toThrow('connection reset');
    expect(listingsService.updateJobItemResult).not.toHaveBeenCalled();
  });

  it('a settings group deleted while the job waited closes every item', async () => {
    const { run, listingsService, quota } = buildProcessor(
      () => Promise.resolve(),
      () => Promise.reject(new NotFoundException('Listing settings group not found'))
    );

    await expect(run()).resolves.toBeUndefined();
    expect(listingsService.updateJobItemResult).toHaveBeenCalledTimes(2);
    expect(quota.releaseForCreate).toHaveBeenCalledWith('user-1', 'item-1');
    expect(quota.releaseForCreate).toHaveBeenCalledWith('user-1', 'item-2');
  });

  it('a transient failure reading the settings group goes to BullMQ for a retry', async () => {
    const { run, listingsService } = buildProcessor(
      () => Promise.resolve(),
      () => Promise.reject(new Error('connection reset'))
    );

    await expect(run()).rejects.toThrow('connection reset');
    expect(listingsService.updateJobItemResult).not.toHaveBeenCalled();
  });
});

describe('updateListing — the settings group must be the seller’s own', () => {
  const listingRow = { id: 'listing-1', user_id: 'user-1', status: ListingStatus.ACTIVE };

  it('refuses a group that belongs to someone else (or does not exist) and updates nothing', async () => {
    const { service, db } = buildService();
    jest.spyOn(service, 'getListing').mockResolvedValue(listingRow as never);

    await expect(service.updateListing('user-1', 'listing-1', { listingSettingsGroupId: GROUP })).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(sqlOf(db).some((sql) => /UPDATE listings/.test(sql))).toBe(false);
    const check = db.query.mock.calls.find((call) => /FROM listing_settings_groups/.test(call[0]));
    expect(check?.[1]).toEqual([GROUP, 'user-1']);
  });

  it('accepts the seller’s own group', async () => {
    const { service, db } = buildService((sql) => (/FROM listing_settings_groups/.test(sql) ? [{ id: GROUP }] : []));
    jest.spyOn(service, 'getListing').mockResolvedValue(listingRow as never);

    await service.updateListing('user-1', 'listing-1', { listingSettingsGroupId: GROUP });
    expect(sqlOf(db).some((sql) => /UPDATE listings/.test(sql))).toBe(true);
  });
});

describe('store filters', () => {
  it('GET /listings/jobs filters on the job’s store and returns it', async () => {
    const now = new Date();
    const { service, db } = buildService((sql) =>
      /COUNT\(\*\)/.test(sql)
        ? [{ count: '1' }]
        : [
            {
              id: 'job-1',
              user_id: 'user-1',
              total_asins: 1,
              processed_count: 0,
              success_count: 0,
              failed_count: 0,
              status: 'pending',
              kind: 'create',
              ebay_account_id: STORE,
              created_at: now,
              updated_at: now,
            },
          ]
    );

    const page = await service.getJobs('user-1', { ebayAccountId: STORE });

    for (const [sql, params] of db.query.mock.calls) {
      expect(sql).toMatch(/ebay_account_id = \$2/);
      expect(params?.[1]).toBe(STORE);
    }
    expect(page.items[0].ebayAccountId).toBe(STORE);
  });

  it('a job with no store reports null', async () => {
    const now = new Date();
    const { service } = buildService((sql) =>
      /COUNT\(\*\)/.test(sql)
        ? [{ count: '1' }]
        : [
            {
              id: 'job-1',
              user_id: 'user-1',
              total_asins: 0,
              processed_count: 0,
              success_count: 0,
              failed_count: 0,
              status: 'completed',
              kind: 'publish',
              ebay_account_id: null,
              created_at: now,
              updated_at: now,
            },
          ]
    );

    const page = await service.getJobs('user-1');
    expect(page.items[0].ebayAccountId).toBeNull();
  });

  it('GET /listings/products keeps only products with a listing on that store, in the count too', async () => {
    const { service, db } = buildService((sql) => (/COUNT\(DISTINCT p\.id\)/.test(sql) ? [{ count: '0' }] : []));

    await service.getUserProducts('user-1', { ebayAccountId: STORE });

    const [countSql, countParams] = db.query.mock.calls[0];
    const [pageSql] = db.query.mock.calls[1];
    expect(countSql).toMatch(/COUNT\(DISTINCT p\.id\)/);
    for (const sql of [countSql, pageSql]) {
      expect(sql).toMatch(/EXISTS \(\s*SELECT 1 FROM listings ls\s+WHERE ls\.product_id = p\.id\s+AND ls\.user_id = \$1\s+AND ls\.ebay_account_id = \$2/);
    }
    expect(countParams).toEqual(['user-1', STORE]);
  });

  it('GET /listings categories follow the same store filter as the list', async () => {
    const { service, db } = buildService((sql) => (/COUNT\(/.test(sql) ? [{ count: '0' }] : []));

    await service.getListings('user-1', { ebayAccountId: STORE });

    const categoryCall = db.query.mock.calls.find((call) => /SELECT DISTINCT COALESCE/.test(call[0]));
    expect(categoryCall?.[0]).toMatch(/l\.ebay_account_id = \$2/);
    expect(categoryCall?.[1]).toEqual(['user-1', STORE]);
  });
});

describe('ListingsController — a store filter that is not a UUID is a 400', () => {
  const listingsService = {
    getJobs: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    getUserProducts: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    getListings: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, categories: [] }),
  };
  const controller = new ListingsController(listingsService as never, {} as never, {} as never);
  const req = { user: { sub: 'user-1' } };

  it('refuses a malformed id on jobs, products and the list', async () => {
    await expect(
      controller.getJobs(req, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'nope')
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getProducts(req, undefined, undefined, undefined, 'nope')).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      controller.getListings(req, undefined, undefined, undefined, undefined, undefined, undefined, 'nope')
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes a valid id through and treats blank as no filter', async () => {
    await controller.getJobs(req, undefined, undefined, undefined, undefined, undefined, undefined, undefined, STORE);
    expect(listingsService.getJobs).toHaveBeenLastCalledWith('user-1', expect.objectContaining({ ebayAccountId: STORE }));
    await controller.getProducts(req, undefined, undefined, undefined, ' ');
    expect(listingsService.getUserProducts).toHaveBeenLastCalledWith(
      'user-1',
      expect.objectContaining({ ebayAccountId: undefined })
    );
  });
});
