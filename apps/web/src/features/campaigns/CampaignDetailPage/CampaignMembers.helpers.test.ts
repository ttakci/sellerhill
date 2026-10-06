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
  it('requires known eligible fixed cost-per-sale running or paused campaigns', () => {
    expect(canWriteCampaign(writable, 'ELIGIBLE')).toBe(true);
    expect(canWriteCampaign({ ...writable, status: EbayCampaignStatus.PAUSED }, 'ELIGIBLE')).toBe(true);
    expect(canWriteCampaign(writable, null)).toBe(false);
    expect(canWriteCampaign({ ...writable, fundingModel: null }, 'ELIGIBLE')).toBe(false);
    expect(canWriteCampaign({ ...writable, status: 'UNKNOWN' }, 'ELIGIBLE')).toBe(false);
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
