import type { ConfigService } from '@nestjs/config';
import { EbayApiResource } from '@repo/shared';

import type { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import type { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';

import { EbayTaxonomyService } from './ebay-taxonomy.service';
import { CategoryAspectsUnavailableError, CategoryResolutionError } from './ebay.errors';

function setup(acquire: jest.Mock) {
  const databaseService = { query: jest.fn().mockResolvedValue([]) };
  const configService = { get: jest.fn().mockReturnValue('https://api.sandbox.ebay.com') };
  const budget = { acquire };
  const service = new EbayTaxonomyService(
    databaseService as unknown as DatabaseService,
    configService as unknown as ConfigService,
    budget as unknown as EbayCallBudgetService
  );
  return { service, databaseService };
}

describe('EbayTaxonomyService — quota refusals must defer, not fail terminally', () => {
  it('resolveCategory rejects with EbayBudgetExhaustedError, not CategoryResolutionError, when Taxonomy is exhausted', async () => {
    const resetAt = new Date(Date.now() + 30_000);
    const acquire = jest
      .fn()
      .mockRejectedValue(new EbayBudgetExhaustedError(EbayApiResource.TAXONOMY, resetAt, 60));
    const { service } = setup(acquire);

    const error = await service
      .resolveCategory({
        accessToken: 'token',
        marketplaceId: 'EBAY_US',
        categoryTreeId: '0',
        title: 'Some Product Title',
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EbayBudgetExhaustedError);
    expect(error).not.toBeInstanceOf(CategoryResolutionError);
  });

  it('getCategoryAspects rejects with EbayBudgetExhaustedError, not CategoryAspectsUnavailableError, when Taxonomy is exhausted and no snapshot exists', async () => {
    const resetAt = new Date(Date.now() + 30_000);
    const acquire = jest
      .fn()
      .mockRejectedValue(new EbayBudgetExhaustedError(EbayApiResource.TAXONOMY, resetAt, 60));
    const { service } = setup(acquire);

    const error = await service
      .getCategoryAspects({
        accessToken: 'token',
        marketplaceId: 'EBAY_US',
        categoryTreeId: '0',
        categoryId: '12345',
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EbayBudgetExhaustedError);
    expect(error).not.toBeInstanceOf(CategoryAspectsUnavailableError);
  });
});
