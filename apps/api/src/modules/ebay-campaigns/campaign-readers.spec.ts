import { readAdsPage, readBulkListingResponse, readCampaignsPage } from './campaign-readers';

describe('readCampaignsPage', () => {
  it('reads the documented fields', () => {
    const page = readCampaignsPage({
      total: 2,
      campaigns: [
        {
          campaignId: '111',
          campaignName: 'A',
          campaignStatus: 'RUNNING',
          startDate: '2026-09-01T00:00:00Z',
          fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'FIXED', bidPercentage: '5.5' },
        },
        {
          campaignId: '222',
          campaignName: 'B',
          campaignStatus: 'PAUSED',
          fundingStrategy: { fundingModel: 'COST_PER_SALE' },
          campaignCriterion: { criterionType: 'INVENTORY_PARTITION' },
        },
      ],
    });
    expect(page?.total).toBe(2);
    expect(page?.campaigns[0]).toEqual({
      campaignId: '111',
      name: 'A',
      status: 'RUNNING',
      fundingModel: 'COST_PER_SALE',
      adRateStrategy: 'FIXED',
      bidPercentage: 5.5,
      ruleBased: false,
      startDate: '2026-09-01T00:00:00Z',
      endDate: null,
    });
    expect(page?.campaigns[1]).toMatchObject({ ruleBased: true, adRateStrategy: null, bidPercentage: null });
  });
  it('drops a campaign without an id and refuses a non-object', () => {
    expect(readCampaignsPage({ campaigns: [{ campaignName: 'x' }] })?.campaigns).toEqual([]);
    expect(readCampaignsPage(['x'])).toBeNull();
    expect(readCampaignsPage({})).toEqual({ campaigns: [], total: null });
  });
});

describe('readAdsPage', () => {
  it('reads listing id and rate', () => {
    expect(readAdsPage({ total: 1, ads: [{ adId: 'a', listingId: '318', bidPercentage: '7.0' }] })).toEqual({
      total: 1,
      ads: [{ listingId: '318', bidPercentage: 7 }],
    });
  });
});

describe('readBulkListingResponse', () => {
  it('a 2xx entry with no errors is ok; an unanswered listing is not', () => {
    const out = readBulkListingResponse(
      {
        responses: [
          { listingId: '1', statusCode: 200 },
          { listingId: '2', statusCode: 400, errors: [{ errorId: 35036 }] },
        ],
      },
      ['1', '2', '3']
    );
    expect(out).toEqual([
      { listingId: '1', ok: true, errorIds: [] },
      { listingId: '2', ok: false, errorIds: [35036] },
      { listingId: '3', ok: false, errorIds: [] },
    ]);
  });
});
