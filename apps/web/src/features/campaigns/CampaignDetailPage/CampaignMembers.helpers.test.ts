import {
  CampaignAddOutcome,
  CampaignReadOnlyReason,
  EbayAdRateStrategy,
  EbayCampaignFundingModel,
  EbayCampaignStatus,
} from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { canWriteCampaign, memberRateLabel, writeOutcome } from './CampaignMembers.helpers';

const writable = {
  readOnlyReason: null,
  ruleBased: false,
  status: EbayCampaignStatus.RUNNING,
  fundingModel: EbayCampaignFundingModel.COST_PER_SALE,
  adRateStrategy: EbayAdRateStrategy.FIXED,
};
describe('campaign member rules', () => {
  it('uses the margin flag independently of synced/applied rate and price locks', () => {
    expect(memberRateLabel({ hasMarginOverride: true, priceLocked: false })).toBe('not-applied');
    expect(memberRateLabel({ hasMarginOverride: false, priceLocked: true })).toBe('price-locked');
    expect(memberRateLabel({ hasMarginOverride: false, priceLocked: false })).toBe(null);
  });
  it.each(Object.values(CampaignReadOnlyReason))('gates server read-only reason %s', (readOnlyReason) => {
    expect(canWriteCampaign({ ...writable, readOnlyReason }, 'ELIGIBLE')).toBe(false);
  });
  it('requires an eligible store and trusts the server read-only verdict', () => {
    const paused = { ...writable, status: EbayCampaignStatus.PAUSED };
    // eBay omits the strategy for its FIXED default; the server still reports no read-only reason.
    const defaultStrategy = { ...writable, adRateStrategy: null };
    expect(canWriteCampaign(writable, 'ELIGIBLE')).toBe(true);
    expect(canWriteCampaign(paused, 'ELIGIBLE')).toBe(true);
    expect(canWriteCampaign(defaultStrategy, 'ELIGIBLE')).toBe(true);
    expect(canWriteCampaign(writable, null)).toBe(false);
    expect(canWriteCampaign(writable, 'INELIGIBLE')).toBe(false);
  });
  it('distinguishes confirmed changes, already-present members, and missing/failed outcomes', () => {
    expect(
      writeOutcome(['a', 'b', 'c', 'd'], {
        results: [
          { listingId: 'a', outcome: CampaignAddOutcome.ADDED },
          { listingId: 'b', outcome: CampaignAddOutcome.ALREADY_IN_CAMPAIGN },
          { listingId: 'c', outcome: CampaignAddOutcome.FAILED },
        ],
      })
    ).toEqual({ changed: ['a'], already: ['b'], failed: ['c', 'd'], unconfirmed: false });
  });
  it('never declares an empty, absent, duplicate, or unknown result successful', () => {
    expect(writeOutcome(['a'], { results: [] }).failed).toEqual(['a']);
    expect(writeOutcome([], { results: [] }).unconfirmed).toBe(true);
    expect(writeOutcome(['a'], undefined).changed).toEqual([]);
    expect(
      writeOutcome(['a'], {
        results: [
          { listingId: 'a', outcome: CampaignAddOutcome.ADDED },
          { listingId: 'a', outcome: CampaignAddOutcome.ADDED },
        ],
      }).failed
    ).toEqual(['a']);
  });
});
