import { readFileSync } from 'fs';
import { join } from 'path';

import {
  EBAY_BULK_ADS_MAX_PER_CALL,
  formatBidPercentage,
  formatCampaignDate,
  parseCampaignIdFromLocation,
  readBulkAdResponse,
  readEbayErrorIds,
  readStandardEligibility,
} from './ebay-promoted.helpers';

describe('formatBidPercentage', () => {
  it('writes eBay single-precision strings', () => {
    expect(formatBidPercentage(5)).toBe('5.0');
    expect(formatBidPercentage(4.1)).toBe('4.1');
    // 10.75 is one of eBay's own examples of an INVALID value.
    expect(formatBidPercentage(10.75)).toBe('10.8');
    expect(formatBidPercentage(2)).toBe('2.0');
  });
});

describe('formatCampaignDate', () => {
  it('drops the milliseconds eBay does not accept', () => {
    expect(formatCampaignDate(new Date('2026-10-02T19:40:00.844Z'))).toBe('2026-10-02T19:40:00Z');
  });
});

describe('parseCampaignIdFromLocation', () => {
  it('reads the id from the getCampaign URI', () => {
    expect(parseCampaignIdFromLocation('https://api.ebay.com/sell/marketing/v1/ad_campaign/1234567890')).toBe(
      '1234567890'
    );
    expect(parseCampaignIdFromLocation('https://api.ebay.com/sell/marketing/v1/ad_campaign/1234567890/')).toBe(
      '1234567890'
    );
  });

  it('answers null for anything that is not a campaign URI', () => {
    expect(parseCampaignIdFromLocation(undefined)).toBeNull();
    expect(parseCampaignIdFromLocation('https://api.ebay.com/sell/marketing/v1/ad_campaign')).toBeNull();
  });
});

describe('readStandardEligibility', () => {
  // The production store's real answer, 2026-10-02.
  const live = {
    advertisingEligibility: [
      { programType: 'OFFSITE_ADS', status: 'INELIGIBLE', reason: 'NOT_ENOUGH_ACTIVITY' },
      { programType: 'PROMOTED_LISTINGS_STANDARD', status: 'INELIGIBLE', reason: 'NOT_ENOUGH_ACTIVITY' },
      { programType: 'PROMOTED_LISTINGS_ADVANCED', status: 'INELIGIBLE', reason: 'NOT_ENOUGH_ACTIVITY' },
    ],
  };

  it('reads the general strategy entry', () => {
    expect(readStandardEligibility(live)).toEqual({ status: 'INELIGIBLE', reason: 'NOT_ENOUGH_ACTIVITY' });
  });

  it('answers unknown rather than guessing when the entry is absent', () => {
    expect(readStandardEligibility({ advertisingEligibility: [] })).toEqual({ status: null, reason: null });
    expect(readStandardEligibility(null)).toEqual({ status: null, reason: null });
  });
});

describe('readBulkAdResponse', () => {
  it('counts a created ad and an already-existing ad as promoted', () => {
    const body = {
      responses: [
        { listingId: '1', statusCode: 201, adId: '900' },
        { listingId: '2', statusCode: 400, errors: [{ errorId: 35036 }] },
        { listingId: '3', statusCode: 409, errors: [{ errorId: 35058 }] },
      ],
    };
    expect(readBulkAdResponse(body, ['1', '2', '3'])).toEqual({
      promoted: ['1', '2'],
      failed: [{ listingId: '3', errorIds: [35058] }],
    });
  });

  it('treats a listing eBay never answered for as a failure', () => {
    expect(readBulkAdResponse({ responses: [] }, ['1'])).toEqual({
      promoted: [],
      failed: [{ listingId: '1', errorIds: [] }],
    });
    expect(readBulkAdResponse(undefined, ['1']).failed).toHaveLength(1);
  });
});

describe('readEbayErrorIds', () => {
  it('reads ids and ignores anything malformed', () => {
    expect(readEbayErrorIds({ errors: [{ errorId: 35046 }, { message: 'x' }, null] })).toEqual([35046]);
    expect(readEbayErrorIds('nope')).toEqual([]);
  });
});

describe('the constants match eBay’s own specification', () => {
  const oas = readFileSync(
    join(__dirname, '../../../../../docs/ebay-reference/sell-marketing-v1-oas3.json'),
    'utf8'
  );

  it('uses the documented paths', () => {
    const paths = Object.keys((JSON.parse(oas) as { paths: Record<string, unknown> }).paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/ad_campaign',
        '/ad_campaign/get_campaign_by_name',
        '/ad_campaign/{campaign_id}/bulk_create_ads_by_listing_id',
      ])
    );
  });

  it('keeps the documented bulk maximum and funding model', () => {
    // The descriptions are HTML; compare their text.
    const text = oas.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    expect(text).toContain(`maximum of ${EBAY_BULK_ADS_MAX_PER_CALL} listings per call`);
    expect(text).toContain('COST_PER_SALE');
    expect(text).toContain('minimum value of 2.0 and a maximum value of 100.0');
  });
});
