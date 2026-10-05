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
  it('rejects malformed pages and incomplete rate-critical campaigns', () => {
    const valid = { campaignId: '1', campaignName: 'A', campaignStatus: 'RUNNING', fundingStrategy: { fundingModel: 'COST_PER_SALE', bidPercentage: '5.0' } };
    expect(readCampaignsPage({ total: 1, campaigns: [{ campaignName: 'x' }] })).toBeNull();
    expect(readCampaignsPage({ total: 1, campaigns: [null] })).toBeNull();
    expect(readCampaignsPage({ total: 1, campaigns: [{ ...valid, campaignStatus: null }] })).toBeNull();
    expect(readCampaignsPage({ total: 1, campaigns: [{ ...valid, fundingStrategy: {} }] })).toBeNull();
    expect(readCampaignsPage({ total: 1, campaigns: [{ ...valid, fundingStrategy: { fundingModel: 'COST_PER_SALE', bidPercentage: 'oops' } }] })).toBeNull();
    expect(readCampaignsPage({ total: 1, campaigns: [{ ...valid, fundingStrategy: { fundingModel: 'COST_PER_SALE' } }] })).toBeNull();
    expect(readCampaignsPage({ total: 1, campaigns: 'bad' })).toBeNull();
    expect(readCampaignsPage({ campaigns: [] })).toBeNull();
    expect(readCampaignsPage({ errors: [{ errorId: 1 }] })).toBeNull();
    expect(readCampaignsPage(['x'])).toBeNull();
    expect(readCampaignsPage({})).toBeNull();
    expect(readCampaignsPage({ total: 0, campaigns: [] })).toEqual({ campaigns: [], total: 0 });
    expect(readCampaignsPage({ total: 1, campaigns: [valid] })?.campaigns[0]).toMatchObject({ adRateStrategy: null, bidPercentage: 5 });
    expect(readCampaignsPage({ total: 1, campaigns: [{ ...valid, fundingStrategy: { fundingModel: 'COST_PER_CLICK' } }] })?.campaigns[0]).toMatchObject({ fundingModel: 'COST_PER_CLICK', bidPercentage: null });
    expect(readCampaignsPage({ total: 1, campaigns: [{ ...valid, campaignCriterion: {}, fundingStrategy: { fundingModel: 'COST_PER_SALE' } }] })?.campaigns[0]).toMatchObject({ ruleBased: true, bidPercentage: null });
  });

  it('rejects a running CPS campaign with null strategy and no fallback bid', () => {
    const campaign = {
      campaignId: '1', campaignName: 'A', campaignStatus: 'RUNNING',
      fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: null },
    };
    expect(readAdsPage({ total: 1, ads: [{ listingId: '318' }] })?.ads[0]).toEqual({
      listingId: '318', bidPercentage: null,
    });
    expect(readCampaignsPage({ total: 1, campaigns: [campaign] })).toBeNull();
    expect(readCampaignsPage({
      total: 1,
      campaigns: [{ ...campaign, fundingStrategy: { ...campaign.fundingStrategy, bidPercentage: '5.0' } }],
    })?.campaigns[0]).toMatchObject({ adRateStrategy: null, bidPercentage: 5 });
  });

  it.each(['0', '101', '5.55'])(
    'rejects an invalid rate-critical RUNNING fixed CPS bid: %s',
    (bidPercentage) => {
      const raw = {
        campaignId: '1',
        campaignName: 'A',
        campaignStatus: 'RUNNING',
        fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'FIXED', bidPercentage },
      };
      expect(readCampaignsPage({ total: 1, campaigns: [raw] })).toBeNull();
    }
  );

  it('does not apply fixed-CPS bid validation to paused or dynamic read-only campaigns', () => {
    const paused = {
      campaignId: '1', campaignName: 'A', campaignStatus: 'PAUSED',
      fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'FIXED', bidPercentage: '0' },
    };
    const dynamic = {
      ...paused,
      campaignStatus: 'RUNNING',
      fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'DYNAMIC', bidPercentage: '101' },
    };
    expect(readCampaignsPage({ total: 1, campaigns: [paused] })).not.toBeNull();
    expect(readCampaignsPage({ total: 1, campaigns: [dynamic] })).not.toBeNull();
  });
});

describe('readAdsPage', () => {
  it('reads listing id and rate', () => {
    expect(readAdsPage({ total: 1, ads: [{ adId: 'a', listingId: '318', bidPercentage: '7.0' }] })).toEqual({
      total: 1,
      ads: [{ listingId: '318', bidPercentage: 7 }],
    });
  });
  it('rejects malformed pages and ads, while retaining an omitted bid for campaign fallback', () => {
    expect(readAdsPage({ total: 0, ads: [] })).toEqual({ total: 0, ads: [] });
    expect(readAdsPage({ total: 1, ads: [{ listingId: '318' }] })?.ads).toEqual([{ listingId: '318', bidPercentage: null }]);
    expect(readAdsPage({ total: 1, ads: [{ adId: 'a' }] })).toBeNull();
    expect(readAdsPage({ total: 1, ads: [{ listingId: '318', bidPercentage: 'bad' }] })).toBeNull();
    expect(readAdsPage({ total: 1, ads: [null] })).toBeNull();
    expect(readAdsPage({ total: 1, ads: 'bad' })).toBeNull();
    expect(readAdsPage({ ads: [] })).toBeNull();
    expect(readAdsPage({ errors: [{ errorId: 1 }] })).toBeNull();
    expect(readAdsPage(null)).toBeNull();
  });

  it.each(['0', '101', '5.55'])(
    'rejects an invalid per-listing bid only when fixed CPS rate is applied: %s',
    (bidPercentage) => {
      const body = { total: 1, ads: [{ listingId: '318', bidPercentage }] };
      expect(readAdsPage(body, true)).toBeNull();
      expect(readAdsPage(body)).not.toBeNull();
    }
  );
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
  it('does not treat missing or malformed response entries as success', () => {
    expect(readBulkListingResponse({}, ['1'])).toEqual([{ listingId: '1', ok: false, errorIds: [] }]);
    expect(readBulkListingResponse({ responses: 'bad' }, ['1'])).toEqual([{ listingId: '1', ok: false, errorIds: [] }]);
    expect(readBulkListingResponse({ responses: [{ listingId: '1', statusCode: '200' }] }, ['1']))
      .toEqual([{ listingId: '1', ok: true, errorIds: [] }]);
  });

  it.each([
    [
      { listingId: '1', statusCode: 400, errors: [{ errorId: 35036 }] },
      { listingId: '1', statusCode: 200 },
    ],
    [
      { listingId: '1', statusCode: 200 },
      { listingId: '1', statusCode: 400, errors: [{ errorId: 35036 }] },
    ],
  ])('marks duplicate listing responses as failed regardless of order: %j', (first, second) => {
    expect(readBulkListingResponse({ responses: [first, second] }, ['1'])).toEqual([
      { listingId: '1', ok: false, errorIds: [] },
    ]);
  });

  it('preserves a unique successful response that has warnings', () => {
    expect(
      readBulkListingResponse(
        { responses: [{ listingId: '1', statusCode: 200, warnings: [{ warningId: 'w1' }] }] },
        ['1']
      )
    ).toEqual([{ listingId: '1', ok: true, errorIds: [] }]);
  });
});
