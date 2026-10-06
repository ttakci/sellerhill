import { ListingsService } from './listings.service';

const userId = 'owner-id';
const listingId = 'listing-id';

function fixture(campaignId: string | null) {
  const row = {
    id: listingId,
    user_id: userId,
    ebay_account_id: 'store-a',
    asin: 'B000000000',
    product_id: 'product-id',
    title: 'Product',
    price: '25.00',
    quantity: 1,
    image_urls: [],
    features: [],
    specs: {},
    identifiers: {},
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    campaign_id: campaignId,
    campaign_name: campaignId ? 'Spring' : null,
    campaign_status: campaignId ? 'RUNNING' : null,
    campaign_funding_model: campaignId ? 'COST_PER_SALE' : null,
    campaign_ad_rate_strategy: campaignId ? 'FIXED' : null,
    promoted_ad_rate: campaignId ? '5.00' : null,
    ad_rate_applied: campaignId ? '5.00' : '0',
    margin_percent_override: campaignId ? '12.00' : null,
  };
  const database = { query: jest.fn().mockResolvedValue([row]) };
  const service = new ListingsService(database as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  return { database, service };
}

describe('listing campaign detail read', () => {
  it('joins the campaign through the listing store and scopes the listing to its owner', async () => {
    const { database, service } = fixture('123');
    const result = await service.getListing(userId, listingId);
    const [sql, params] = database.query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('c.ebay_account_id = l.ebay_account_id AND c.campaign_id = l.promoted_campaign_id');
    expect(sql).toContain('WHERE l.id = $1 AND l.user_id = $2');
    expect(params).toEqual([listingId, userId]);
    expect(result?.adCampaign).toEqual({
      campaignId: '123', name: 'Spring', status: 'RUNNING', fundingModel: 'COST_PER_SALE',
      adRateStrategy: 'FIXED', adRate: 5, appliedAdRate: 5,
    });
    expect(result?.marginPercentOverride).toBe(12);
  });

  it('returns null association when no campaign joins', async () => {
    const { service } = fixture(null);
    expect((await service.getListing(userId, listingId))?.adCampaign).toBeNull();
  });

  it('returns no listing when the owned read finds no row', async () => {
    const { database, service } = fixture('123');
    database.query.mockResolvedValue([]);
    expect(await service.getListing('another-user', listingId)).toBeNull();
  });
});
