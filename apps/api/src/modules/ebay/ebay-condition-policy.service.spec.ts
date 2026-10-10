import type { ConfigService } from '@nestjs/config';
import { EbayApiResource } from '@repo/shared';
import axios from 'axios';

import type { DatabaseService } from '../../common/database/database.service';
import type { EbayApplicationTokenService } from '../../common/ebay-budget/ebay-application-token.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import type { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';

import { EbayConditionPolicyService } from './ebay-condition-policy.service';
import { EbayConditionEnum } from './listing-condition';

jest.mock('axios');
const mockedGet = jest.fn();
(axios as unknown as { get: jest.Mock }).get = mockedGet;

function setup(opts: { acquire?: jest.Mock; rows?: unknown[]; dbFails?: boolean } = {}) {
  const query = opts.dbFails
    ? jest.fn().mockRejectedValue(new Error('db down'))
    : jest.fn().mockImplementation((sql: string) =>
        Promise.resolve(sql.trim().startsWith('SELECT') ? (opts.rows ?? []) : [])
      );
  const acquire = opts.acquire ?? jest.fn().mockResolvedValue(undefined);
  const service = new EbayConditionPolicyService(
    { query } as unknown as DatabaseService,
    { get: () => 'https://api.test' } as unknown as ConfigService,
    { acquire } as unknown as EbayCallBudgetService,
    { get: () => Promise.resolve('app-token') } as unknown as EbayApplicationTokenService
  );
  return { service, query, acquire };
}

const policy = (ids: string[], required = false) => ({
  data: { itemConditionPolicies: [{ categoryId: '123', itemConditionRequired: required, itemConditions: ids.map((conditionId) => ({ conditionId })) }] },
});

describe('EbayConditionPolicyService', () => {
  beforeEach(() => mockedGet.mockReset());

  it('moves NEW to the category-allowed NEW_OTHER, charges METADATA, and caches in the DB', async () => {
    mockedGet.mockResolvedValue(policy(['1500', '3000']));
    const { service, query, acquire } = setup();

    await expect(service.resolveCondition('Fresh fruit basket', 'EBAY_US', '123')).resolves.toBe(
      EbayConditionEnum.NEW_OTHER
    );

    expect(acquire).toHaveBeenCalledWith(EbayApiResource.METADATA);
    const call = mockedGet.mock.calls[0] as [string, { headers: { Authorization: string } }];
    const [url, config] = call;
    expect(url).toContain('/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=');
    expect(decodeURIComponent(url)).toContain('categoryIds:{123}');
    expect(config.headers.Authorization).toBe('Bearer app-token');
    expect((query.mock.calls as unknown[][]).some((c) => String(c[0]).includes('INSERT INTO ebay_category_conditions'))).toBe(true);
  });

  it('serves a second lookup from memory without calling eBay again', async () => {
    mockedGet.mockResolvedValue(policy(['1000']));
    const { service } = setup();
    await service.resolveCondition('x', 'EBAY_US', '123');
    await service.resolveCondition('y', 'EBAY_US', '123');
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh DB snapshot without calling eBay', async () => {
    const { service } = setup({
      rows: [{ condition_required: false, condition_ids: ['1500'], fetched_at: new Date() }],
    });
    await expect(service.resolveCondition('x', 'EBAY_US', '123')).resolves.toBe(EbayConditionEnum.NEW_OTHER);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('serves a stale snapshot when eBay fails', async () => {
    mockedGet.mockRejectedValue(new Error('boom'));
    const { service } = setup({
      rows: [{ condition_required: false, condition_ids: ['1500'], fetched_at: new Date(Date.now() - 30 * 86_400_000) }],
    });
    await expect(service.resolveCondition('x', 'EBAY_US', '123')).resolves.toBe(EbayConditionEnum.NEW_OTHER);
  });

  it('keeps the title-derived condition when eBay fails and nothing is cached', async () => {
    mockedGet.mockRejectedValue(new Error('boom'));
    const { service } = setup();
    await expect(service.resolveCondition('x', 'EBAY_US', '123')).resolves.toBe(EbayConditionEnum.NEW);
  });

  it('keeps the title-derived condition when the budget is exhausted', async () => {
    const acquire = jest
      .fn()
      .mockRejectedValue(new EbayBudgetExhaustedError(EbayApiResource.METADATA, new Date(Date.now() + 1000), 60));
    const { service } = setup({ acquire });
    await expect(service.resolveCondition('x', 'EBAY_US', '123')).resolves.toBe(EbayConditionEnum.NEW);
  });

  it('never throws when the database is down', async () => {
    mockedGet.mockResolvedValue(policy(['1500']));
    const { service } = setup({ dbFails: true });
    await expect(service.resolveCondition('x', 'EBAY_US', '123')).resolves.toBe(EbayConditionEnum.NEW_OTHER);
  });

  it('treats a response without conditions as an unknown policy', async () => {
    mockedGet.mockResolvedValue({ data: { itemConditionPolicies: [] } });
    const { service } = setup();
    await expect(service.resolveCondition('x', 'EBAY_US', '123')).resolves.toBe(EbayConditionEnum.NEW);
  });
});
